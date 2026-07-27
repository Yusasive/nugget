import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  InvoiceDto,
  PaginatedResponse,
  RestaurantOrderDto,
} from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import { InvoiceService } from '../billing/invoice.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { RedisLockService } from '../redis/redis-lock.service';
import { AddOrderItemsDto } from './dto/add-order-items.dto';
import { CancelRestaurantOrderDto } from './dto/cancel-restaurant-order.dto';
import { CreateRestaurantOrderDto } from './dto/create-restaurant-order.dto';
import { ListRestaurantOrdersQueryDto } from './dto/list-restaurant-orders-query.dto';
import { UpdateKitchenItemStatusDto } from './dto/update-kitchen-item-status.dto';
import {
  RESTAURANT_ORDER_INCLUDE,
  toRestaurantOrderDto,
  type RestaurantOrderWithRelations,
} from './restaurant-order.mapper';
import {
  assertForwardKitchenTransition,
  computeOrderTotal,
} from './restaurant-order.util';

@Injectable()
export class RestaurantOrderService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly redisLock: RedisLockService,
    private readonly audit: AuditService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async list(
    query: ListRestaurantOrdersQueryDto,
  ): Promise<PaginatedResponse<RestaurantOrderDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.RestaurantOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.orderType ? { orderType: query.orderType } : {}),
      ...(query.tableId ? { tableId: query.tableId } : {}),
    };

    const [orders, total] = await Promise.all([
      this.scopedPrisma.restaurantOrder.findMany({
        where,
        skip,
        take,
        include: RESTAURANT_ORDER_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
      this.scopedPrisma.restaurantOrder.count({ where }),
    ]);
    return buildPaginatedResponse(
      orders.map(toRestaurantOrderDto),
      total,
      page,
      pageSize,
    );
  }

  /** The Kitchen Display's feed (TRD §7: polled every 3-5s) — orders sent to
   * the kitchen that still have at least one item not yet SERVED, oldest
   * first so the longest-waiting ticket surfaces first. */
  async kitchenDisplay(): Promise<RestaurantOrderDto[]> {
    const orders = await this.scopedPrisma.restaurantOrder.findMany({
      where: {
        status: 'SENT_TO_KITCHEN',
        items: { some: { kitchenStatus: { not: 'SERVED' } } },
      },
      include: RESTAURANT_ORDER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return orders.map(toRestaurantOrderDto);
  }

  async findOneOrThrow(id: string): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(id);
    return toRestaurantOrderDto(order);
  }

  private async findRawOrThrow(
    id: string,
  ): Promise<RestaurantOrderWithRelations> {
    const order = await this.scopedPrisma.restaurantOrder.findUnique({
      where: { id },
      include: RESTAURANT_ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException('Restaurant order not found');
    }
    return order;
  }

  /**
   * Table assignment for a DINE_IN order mirrors room/tour-departure
   * double-booking prevention (TRD §6): a Redis lock on
   * `lock:restaurant-table:<id>` serializes concurrent seating attempts,
   * and the table's FREE status is re-checked inside the same Postgres
   * transaction as the order insert.
   */
  async create(
    dto: CreateRestaurantOrderDto,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    if (dto.orderType === 'DINE_IN' && !dto.tableId) {
      throw new BadRequestException('tableId is required for a dine-in order');
    }
    if (dto.orderType !== 'DINE_IN' && dto.tableId) {
      throw new BadRequestException(
        'tableId is only valid for a dine-in order',
      );
    }
    if (dto.orderType === 'ROOM_SERVICE' && !dto.roomBookingId) {
      throw new BadRequestException(
        'roomBookingId is required for a room-service order',
      );
    }
    if (dto.orderType !== 'ROOM_SERVICE' && dto.roomBookingId) {
      throw new BadRequestException(
        'roomBookingId is only valid for a room-service order',
      );
    }

    if (dto.orderType === 'DINE_IN') {
      return this.redisLock.withLock(
        `lock:restaurant-table:${dto.tableId}`,
        () => this.createCore(dto, actor),
      );
    }
    return this.createCore(dto, actor);
  }

  private async createCore(
    dto: CreateRestaurantOrderDto,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    return this.prisma.$transaction(async (tx) => {
      let branchId = actor.branchId;

      if (dto.tableId) {
        const table = await tx.restaurantTable.findUnique({
          where: { id: dto.tableId },
        });
        if (
          !table ||
          (actor.role !== 'SUPER_ADMIN' && table.branchId !== actor.branchId)
        ) {
          throw new NotFoundException('Table not found');
        }
        if (table.status !== 'FREE') {
          throw new ConflictException('This table is not free');
        }
        branchId = table.branchId;
        await tx.restaurantTable.update({
          where: { id: table.id },
          data: { status: 'OCCUPIED' },
        });
      }

      if (dto.roomBookingId) {
        const booking = await tx.booking.findUnique({
          where: { id: dto.roomBookingId },
        });
        if (
          !booking ||
          (actor.role !== 'SUPER_ADMIN' &&
            booking.branchId !== actor.branchId)
        ) {
          throw new NotFoundException('Room booking not found');
        }
        if (
          booking.status === 'HELD' ||
          booking.status === 'CANCELLED' ||
          booking.status === 'EXPIRED'
        ) {
          throw new ConflictException(
            'This room booking cannot accept a room-service order',
          );
        }
        branchId = booking.branchId;
      }

      if (dto.guestId) {
        const guest = await tx.guest.findUnique({
          where: { id: dto.guestId },
        });
        if (!guest) {
          throw new NotFoundException('Guest not found');
        }
      }

      const order = await tx.restaurantOrder.create({
        data: {
          branchId,
          orderType: dto.orderType,
          tableId: dto.tableId,
          roomBookingId: dto.roomBookingId,
          guestId: dto.guestId,
          createdByStaffId: actor.staffId,
        },
        include: RESTAURANT_ORDER_INCLUDE,
      });

      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId,
        action: 'restaurant-order.create',
        entityType: 'RestaurantOrder',
        entityId: order.id,
        metadata: { orderType: dto.orderType },
      });

      return toRestaurantOrderDto(order);
    });
  }

  /** Allowed while the order hasn't been billed/cancelled yet, so a waiter
   * can add a round of drinks after the first course is already in the
   * kitchen — new items always start at PENDING and flow through the KOT
   * pipeline independently of items already in progress. */
  async addItems(
    id: string,
    dto: AddOrderItemsDto,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(id);
    if (order.status !== 'OPEN' && order.status !== 'SENT_TO_KITCHEN') {
      throw new ConflictException(
        `Cannot add items to an order with status ${order.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      for (const line of dto.items) {
        const menuItem = await tx.menuItem.findUnique({
          where: { id: line.menuItemId },
        });
        if (!menuItem || menuItem.branchId !== order.branchId) {
          throw new NotFoundException('Menu item not found');
        }
        if (!menuItem.isAvailable) {
          throw new BadRequestException(
            `"${menuItem.name}" is not currently available`,
          );
        }
        await tx.orderItem.create({
          data: {
            branchId: order.branchId,
            orderId: order.id,
            menuItemId: menuItem.id,
            quantity: line.quantity,
            notes: line.notes,
            unitPriceAtOrder: menuItem.price,
          },
        });
      }

      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: order.branchId,
        action: 'restaurant-order.add-items',
        entityType: 'RestaurantOrder',
        entityId: order.id,
        metadata: { itemCount: dto.items.length },
      });

      const updated = await tx.restaurantOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: RESTAURANT_ORDER_INCLUDE,
      });
      return toRestaurantOrderDto(updated);
    });
  }

  async sendToKitchen(
    id: string,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(id);
    if (order.status !== 'OPEN') {
      throw new ConflictException(
        `Cannot send an order with status ${order.status} to the kitchen`,
      );
    }
    if (order.items.length === 0) {
      throw new BadRequestException('Cannot send an empty order to the kitchen');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurantOrder.update({
        where: { id: order.id },
        data: { status: 'SENT_TO_KITCHEN' },
        include: RESTAURANT_ORDER_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: order.branchId,
        action: 'restaurant-order.send-to-kitchen',
        entityType: 'RestaurantOrder',
        entityId: order.id,
      });
      return toRestaurantOrderDto(updated);
    });
  }

  /** Advances one line item through the KOT pipeline (TRD §3.3) —
   * PENDING → PREPARING → READY → SERVED, forward-only. */
  async advanceItemStatus(
    orderId: string,
    itemId: string,
    dto: UpdateKitchenItemStatusDto,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(orderId);
    const item = order.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException('Order item not found');
    }
    assertForwardKitchenTransition(item.kitchenStatus, dto.status);

    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { kitchenStatus: dto.status },
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: order.branchId,
        action: 'restaurant-order.item.advance',
        entityType: 'OrderItem',
        entityId: item.id,
        metadata: { from: item.kitchenStatus, to: dto.status },
      });
      const updated = await tx.restaurantOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: RESTAURANT_ORDER_INCLUDE,
      });
      return toRestaurantOrderDto(updated);
    });
  }

  /** Only once every item has been SERVED by the kitchen — the floor closes
   * the loop by marking the whole order served. */
  async markServed(
    id: string,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(id);
    if (order.status !== 'SENT_TO_KITCHEN') {
      throw new ConflictException(
        `Cannot serve an order with status ${order.status}`,
      );
    }
    if (order.items.some((item) => item.kitchenStatus !== 'SERVED')) {
      throw new ConflictException(
        'Every item must be SERVED before the order can be marked served',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurantOrder.update({
        where: { id: order.id },
        data: { status: 'SERVED' },
        include: RESTAURANT_ORDER_INCLUDE,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: order.branchId,
        action: 'restaurant-order.serve',
        entityType: 'RestaurantOrder',
        entityId: order.id,
      });
      return toRestaurantOrderDto(updated);
    });
  }

  /**
   * Finalizes billing (PRD §5.9's "served and billed"). A room-service
   * order lands a FolioCharge on the linked stay's folio, the same
   * "write directly inside this transaction rather than call FolioService"
   * pattern TourBookingService.confirm uses for bundled tours. A dine-in or
   * takeaway order issues a standalone Invoice instead — see
   * InvoiceService.issueInvoiceForRestaurantOrder's doc comment for what
   * PAID does and doesn't mean here.
   */
  async bill(id: string, actor: ActorContext): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(id);
    if (order.status !== 'SERVED') {
      throw new ConflictException(
        `Cannot bill an order with status ${order.status}`,
      );
    }

    if (order.roomBookingId) {
      const roomBookingId = order.roomBookingId;
      return this.prisma.$transaction(async (tx) => {
        const linkedBooking = await tx.booking.findUnique({
          where: { id: roomBookingId },
        });
        if (
          !linkedBooking ||
          linkedBooking.status === 'HELD' ||
          linkedBooking.status === 'CANCELLED' ||
          linkedBooking.status === 'EXPIRED'
        ) {
          throw new ConflictException(
            'The linked room booking is no longer able to accept folio charges',
          );
        }
        const amount = computeOrderTotal(order.items);
        await tx.folioCharge.create({
          data: {
            branchId: order.branchId,
            bookingId: roomBookingId,
            category: 'RESTAURANT',
            description: `Room service order — ${order.items.length} item(s)`,
            amount,
            createdByStaffId: actor.staffId,
          },
        });
        const updated = await tx.restaurantOrder.update({
          where: { id: order.id },
          data: { status: 'PAID' },
          include: RESTAURANT_ORDER_INCLUDE,
        });
        await this.audit.record(tx, {
          staffId: actor.staffId,
          branchId: order.branchId,
          action: 'restaurant-order.bill.folio',
          entityType: 'RestaurantOrder',
          entityId: order.id,
          metadata: { amount: amount.toString() },
        });
        return toRestaurantOrderDto(updated);
      });
    }

    await this.invoiceService.issueInvoiceForRestaurantOrder(order.id, actor);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurantOrder.update({
        where: { id: order.id },
        data: { status: 'PAID' },
        include: RESTAURANT_ORDER_INCLUDE,
      });
      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: 'FREE' },
        });
      }
      return toRestaurantOrderDto(updated);
    });
  }

  /** From OPEN/SENT_TO_KITCHEN only — once SERVED, billing is the only path
   * forward. Frees a dine-in order's table back to FREE. */
  async cancel(
    id: string,
    dto: CancelRestaurantOrderDto,
    actor: ActorContext,
  ): Promise<RestaurantOrderDto> {
    const order = await this.findRawOrThrow(id);
    if (order.status !== 'OPEN' && order.status !== 'SENT_TO_KITCHEN') {
      throw new ConflictException(
        `Cannot cancel an order with status ${order.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.restaurantOrder.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
        include: RESTAURANT_ORDER_INCLUDE,
      });
      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: 'FREE' },
        });
      }
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: order.branchId,
        action: 'restaurant-order.cancel',
        entityType: 'RestaurantOrder',
        entityId: order.id,
        metadata: dto.reason ? { reason: dto.reason } : undefined,
      });
      return toRestaurantOrderDto(updated);
    });
  }
}

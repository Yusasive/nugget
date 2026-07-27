import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  InventoryItemDto,
  PaginatedResponse,
  StockMovementDto,
} from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { ActorContext } from '../context/actor.types';
import type { Prisma } from '../generated/prisma/client';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { RecordStockMovementDto } from './dto/record-stock-movement.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { applyStockMovement } from './inventory-item.util';
import { toInventoryItemDto } from './inventory-item.mapper';

@Injectable()
export class InventoryItemService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListInventoryItemsQueryDto,
  ): Promise<PaginatedResponse<InventoryItemDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.InventoryItemWhereInput = {
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };

    // Low-stock is a computed comparison (quantityOnHand <= reorderThreshold)
    // — Prisma can't compare two columns in a `where`, so when that filter
    // is requested this fetches every matching row and paginates in memory
    // rather than trying to push the comparison down. Inventory catalogs are
    // small enough per branch that this doesn't need the same
    // pagination-pushdown care as the room-status board.
    if (query.lowStockOnly) {
      const all = await this.scopedPrisma.inventoryItem.findMany({
        where,
        orderBy: { name: 'asc' },
      });
      const lowStock = all.filter((i) =>
        i.quantityOnHand.lte(i.reorderThreshold),
      );
      return buildPaginatedResponse(
        lowStock.slice(skip, skip + take).map(toInventoryItemDto),
        lowStock.length,
        page,
        pageSize,
      );
    }

    const [items, total] = await Promise.all([
      this.scopedPrisma.inventoryItem.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.scopedPrisma.inventoryItem.count({ where }),
    ]);
    return buildPaginatedResponse(
      items.map(toInventoryItemDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<InventoryItemDto> {
    const item = await this.scopedPrisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }
    return toInventoryItemDto(item);
  }

  async create(dto: CreateInventoryItemDto): Promise<InventoryItemDto> {
    const item = await this.scopedPrisma.inventoryItem.create({ data: dto });
    return toInventoryItemDto(item);
  }

  async update(
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    await this.findOneOrThrow(id);
    const item = await this.scopedPrisma.inventoryItem.update({
      where: { id },
      data: dto,
    });
    return toInventoryItemDto(item);
  }

  /** Manual stock in/out (PRD §5.10) — consumption, waste, adjustments.
   * PURCHASE-reason movements only ever come from PurchaseRecordService. */
  async recordMovement(
    id: string,
    dto: RecordStockMovementDto,
    actor: ActorContext,
  ): Promise<{
    item: InventoryItemDto;
    movement: Pick<StockMovementDto, 'id'>;
  }> {
    const existing = await this.findOneOrThrow(id);

    return this.prisma.$transaction(async (tx) => {
      const { item, movementId } = await applyStockMovement(tx, {
        branchId: existing.branchId,
        inventoryItemId: id,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason,
        createdByStaffId: actor.staffId,
      });
      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId: existing.branchId,
        action: 'inventory-item.stock-movement',
        entityType: 'InventoryItem',
        entityId: id,
        metadata: {
          type: dto.type,
          quantity: dto.quantity,
          reason: dto.reason,
        },
      });
      return { item: toInventoryItemDto(item), movement: { id: movementId } };
    });
  }
}

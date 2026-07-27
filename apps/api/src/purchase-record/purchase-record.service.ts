import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  PaginatedResponse,
  PurchaseLineItem,
  PurchaseRecordDto,
} from '@nugget/shared-types';
import { AuditService } from '../audit/audit.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/pagination';
import type { ActorContext } from '../context/actor.types';
import { Prisma } from '../generated/prisma/client';
import { findOrCreateRestaurantPurchasesCategory } from '../expense-category/expense-category.util';
import { applyStockMovement } from '../inventory-item/inventory-item.util';
import { SCOPED_PRISMA } from '../prisma/branch-scope.extension';
import type { ScopedPrismaClient } from '../prisma/branch-scope.extension';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseRecordDto } from './dto/create-purchase-record.dto';
import { ListPurchaseRecordsQueryDto } from './dto/list-purchase-records-query.dto';
import {
  PURCHASE_RECORD_INCLUDE,
  toPurchaseRecordDto,
  type PurchaseRecordWithRelations,
} from './purchase-record.mapper';
import {
  assertNonEmptyLineItems,
  computePurchaseTotal,
} from './purchase-record.util';

@Injectable()
export class PurchaseRecordService {
  constructor(
    @Inject(SCOPED_PRISMA) private readonly scopedPrisma: ScopedPrismaClient,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: ListPurchaseRecordsQueryDto,
  ): Promise<PaginatedResponse<PurchaseRecordDto>> {
    const { page, pageSize, skip, take } = normalizePagination(query);
    const where: Prisma.PurchaseRecordWhereInput = {
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    };

    const [records, total] = await Promise.all([
      this.scopedPrisma.purchaseRecord.findMany({
        where,
        skip,
        take,
        include: {
          ...PURCHASE_RECORD_INCLUDE,
          expense: { select: { id: true } },
        },
        orderBy: { purchasedAt: 'desc' },
      }),
      this.scopedPrisma.purchaseRecord.count({ where }),
    ]);
    return buildPaginatedResponse(
      (records as PurchaseRecordWithRelations[]).map(toPurchaseRecordDto),
      total,
      page,
      pageSize,
    );
  }

  async findOneOrThrow(id: string): Promise<PurchaseRecordDto> {
    const record = await this.scopedPrisma.purchaseRecord.findUnique({
      where: { id },
      include: {
        ...PURCHASE_RECORD_INCLUDE,
        expense: { select: { id: true } },
      },
    });
    if (!record) {
      throw new NotFoundException('Purchase record not found');
    }
    return toPurchaseRecordDto(record);
  }

  /**
   * TRD §4's atomicity requirement, verified end-to-end by
   * test/purchase-record.e2e-spec.ts: recording a purchase creates one
   * StockMovement per line item (type=IN, reason=PURCHASE) and one Expense
   * row, all in the single transaction below — a failure on any line item
   * (unknown inventory item, wrong branch) rolls back every write already
   * made in this call, including StockMovements for line items processed
   * before the failing one and the InventoryItem quantity updates they made.
   */
  async create(
    dto: CreatePurchaseRecordDto,
    actor: ActorContext,
  ): Promise<PurchaseRecordDto> {
    assertNonEmptyLineItems(dto.lineItems);
    const branchId =
      actor.role === 'SUPER_ADMIN' ? dto.branchId : actor.branchId;

    return this.prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier || supplier.branchId !== branchId) {
        throw new NotFoundException('Supplier not found');
      }

      const enrichedLineItems: PurchaseLineItem[] = [];
      for (const line of dto.lineItems) {
        const inventoryItem = await tx.inventoryItem.findUnique({
          where: { id: line.inventoryItemId },
        });
        if (!inventoryItem || inventoryItem.branchId !== branchId) {
          throw new NotFoundException(
            `Inventory item ${line.inventoryItemId} not found`,
          );
        }
        enrichedLineItems.push({
          inventoryItemId: line.inventoryItemId,
          inventoryItemName: inventoryItem.name,
          quantity: line.quantity,
          unitCost: line.unitCost,
        });
      }
      const totalCost = computePurchaseTotal(dto.lineItems);

      const purchaseRecord = await tx.purchaseRecord.create({
        data: {
          branchId,
          supplierId: supplier.id,
          lineItems: enrichedLineItems as unknown as Prisma.InputJsonValue,
          totalCost,
          purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
          createdByStaffId: actor.staffId,
        },
      });

      for (const line of dto.lineItems) {
        await applyStockMovement(tx, {
          branchId,
          inventoryItemId: line.inventoryItemId,
          type: 'IN',
          quantity: line.quantity,
          reason: 'PURCHASE',
          referenceId: purchaseRecord.id,
          createdByStaffId: actor.staffId,
        });
      }

      const categoryId = await findOrCreateRestaurantPurchasesCategory(
        tx,
        branchId,
      );
      await tx.expense.create({
        data: {
          branchId,
          categoryId,
          purchaseRecordId: purchaseRecord.id,
          amount: totalCost,
          description: `Purchase from ${supplier.name}`,
          incurredAt: purchaseRecord.purchasedAt,
          createdByStaffId: actor.staffId,
        },
      });

      await this.audit.record(tx, {
        staffId: actor.staffId,
        branchId,
        action: 'purchase-record.create',
        entityType: 'PurchaseRecord',
        entityId: purchaseRecord.id,
        metadata: {
          totalCost: totalCost.toString(),
          lineItemCount: dto.lineItems.length,
        },
      });

      const withRelations = await tx.purchaseRecord.findUniqueOrThrow({
        where: { id: purchaseRecord.id },
        include: {
          ...PURCHASE_RECORD_INCLUDE,
          expense: { select: { id: true } },
        },
      });
      return toPurchaseRecordDto(withRelations);
    });
  }
}

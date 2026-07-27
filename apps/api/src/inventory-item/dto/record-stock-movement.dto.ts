import { IsEnum, IsIn, Matches } from 'class-validator';
import {
  STOCK_MOVEMENT_REASONS,
  STOCK_MOVEMENT_TYPES,
  type RecordStockMovementRequestBody,
  type StockMovementReason,
  type StockMovementType,
} from '@nugget/shared-types';

const DECIMAL_PATTERN = /^\d+(\.\d{1,3})?$/;
const MANUAL_REASONS = STOCK_MOVEMENT_REASONS.filter((r) => r !== 'PURCHASE');

export class RecordStockMovementDto implements RecordStockMovementRequestBody {
  @IsEnum(STOCK_MOVEMENT_TYPES)
  type: StockMovementType;

  @Matches(DECIMAL_PATTERN, {
    message: 'quantity must look like "10" or "10.500"',
  })
  quantity: string;

  /** PURCHASE is excluded — that reason is only ever written by
   * PurchaseRecordService, atomically with the purchase itself. */
  @IsIn(MANUAL_REASONS)
  reason: Exclude<StockMovementReason, 'PURCHASE'>;
}

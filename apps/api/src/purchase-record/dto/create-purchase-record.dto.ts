import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import type {
  CreatePurchaseRecordRequestBody,
  PurchaseLineItemInput,
} from '@nugget/shared-types';

const DECIMAL_PATTERN = /^\d+(\.\d{1,3})?$/;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class PurchaseLineItemInputDto implements PurchaseLineItemInput {
  @IsUUID()
  inventoryItemId: string;

  @Matches(DECIMAL_PATTERN, {
    message: 'quantity must look like "10" or "10.500"',
  })
  quantity: string;

  @Matches(MONEY_PATTERN, {
    message: 'unitCost must look like "10" or "10.00"',
  })
  unitCost: string;
}

export class CreatePurchaseRecordDto implements CreatePurchaseRecordRequestBody {
  @IsUUID()
  branchId: string;

  @IsUUID()
  supplierId: string;

  @ValidateNested({ each: true })
  @Type(() => PurchaseLineItemInputDto)
  @ArrayMinSize(1)
  lineItems: PurchaseLineItemInputDto[];

  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}

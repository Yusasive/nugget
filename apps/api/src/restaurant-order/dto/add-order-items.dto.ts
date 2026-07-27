import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  AddOrderItemInput,
  AddOrderItemsRequestBody,
} from '@nugget/shared-types';

export class AddOrderItemInputDto implements AddOrderItemInput {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddOrderItemsDto implements AddOrderItemsRequestBody {
  @ValidateNested({ each: true })
  @Type(() => AddOrderItemInputDto)
  @ArrayMinSize(1)
  items: AddOrderItemInputDto[];
}

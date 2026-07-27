import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import {
  FOLIO_CHARGE_CATEGORIES,
  type CreateFolioChargeRequestBody,
  type FolioChargeCategory,
} from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class CreateFolioChargeDto implements CreateFolioChargeRequestBody {
  @IsOptional()
  @IsEnum(FOLIO_CHARGE_CATEGORIES)
  category?: FolioChargeCategory;

  @IsString()
  @MinLength(2)
  description: string;

  @Matches(MONEY_PATTERN, { message: 'amount must look like "50" or "50.00"' })
  amount: string;
}

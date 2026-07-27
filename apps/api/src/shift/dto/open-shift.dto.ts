import { Matches } from 'class-validator';
import type { OpenShiftRequestBody } from '@nugget/shared-types';

const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;

export class OpenShiftDto implements OpenShiftRequestBody {
  @Matches(MONEY_PATTERN, {
    message: 'openingCash must look like "50" or "50.00"',
  })
  openingCash: string;
}

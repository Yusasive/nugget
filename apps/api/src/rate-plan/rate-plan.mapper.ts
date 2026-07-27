import type { RatePlanDto } from '@nugget/shared-types';
import type { RatePlan } from '../generated/prisma/client';

export function toRatePlanDto(ratePlan: RatePlan): RatePlanDto {
  return {
    id: ratePlan.id,
    branchId: ratePlan.branchId,
    roomTypeId: ratePlan.roomTypeId,
    name: ratePlan.name,
    type: ratePlan.type,
    pricePerNight: ratePlan.pricePerNight.toString(),
    validFrom: ratePlan.validFrom ? ratePlan.validFrom.toISOString() : null,
    validTo: ratePlan.validTo ? ratePlan.validTo.toISOString() : null,
    isActive: ratePlan.isActive,
  };
}

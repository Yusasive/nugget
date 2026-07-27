import type { TourGuideDto } from '@nugget/shared-types';
import type { TourGuide } from '../generated/prisma/client';

export function toTourGuideDto(guide: TourGuide): TourGuideDto {
  return {
    id: guide.id,
    branchId: guide.branchId,
    fullName: guide.fullName,
    phone: guide.phone,
    email: guide.email,
    isActive: guide.isActive,
    createdAt: guide.createdAt.toISOString(),
    updatedAt: guide.updatedAt.toISOString(),
  };
}

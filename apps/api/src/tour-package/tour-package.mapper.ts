import type { TourPackageDto } from '@nugget/shared-types';
import type { TourPackage } from '../generated/prisma/client';

export function toTourPackageDto(pkg: TourPackage): TourPackageDto {
  return {
    id: pkg.id,
    branchId: pkg.branchId,
    name: pkg.name,
    description: pkg.description,
    itinerary: pkg.itinerary,
    durationMinutes: pkg.durationMinutes,
    defaultPricePerSeat: pkg.defaultPricePerSeat.toString(),
    defaultCapacity: pkg.defaultCapacity,
    imageUrls: pkg.imageUrls,
    isActive: pkg.isActive,
    createdAt: pkg.createdAt.toISOString(),
    updatedAt: pkg.updatedAt.toISOString(),
  };
}

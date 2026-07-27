import type { VehicleDto } from '@nugget/shared-types';
import type { Vehicle } from '../generated/prisma/client';

export function toVehicleDto(vehicle: Vehicle): VehicleDto {
  return {
    id: vehicle.id,
    branchId: vehicle.branchId,
    name: vehicle.name,
    plateNumber: vehicle.plateNumber,
    capacity: vehicle.capacity,
    isActive: vehicle.isActive,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  };
}

import type { SupplierDto } from '@nugget/shared-types';
import type { Supplier } from '../generated/prisma/client';

export function toSupplierDto(supplier: Supplier): SupplierDto {
  return {
    id: supplier.id,
    branchId: supplier.branchId,
    name: supplier.name,
    phone: supplier.phone,
    contactNotes: supplier.contactNotes,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  };
}

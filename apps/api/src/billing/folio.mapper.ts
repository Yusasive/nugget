import type { FolioChargeDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const FOLIO_CHARGE_INCLUDE = {
  createdByStaff: true,
} as const;

export type FolioChargeWithRelations = Prisma.FolioChargeGetPayload<{
  include: typeof FOLIO_CHARGE_INCLUDE;
}>;

export function toFolioChargeDto(
  charge: FolioChargeWithRelations,
): FolioChargeDto {
  return {
    id: charge.id,
    bookingId: charge.bookingId,
    category: charge.category,
    description: charge.description,
    amount: charge.amount.toString(),
    createdByStaff: {
      id: charge.createdByStaff.id,
      firstName: charge.createdByStaff.firstName,
      lastName: charge.createdByStaff.lastName,
    },
    createdAt: charge.createdAt.toISOString(),
  };
}

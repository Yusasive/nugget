import type { GuestProfileDto } from '@nugget/shared-types';
import type { Prisma } from '../generated/prisma/client';

export const GUEST_INCLUDE = {} as const;

export type GuestWithRelations = Prisma.GuestGetPayload<{
  include: typeof GUEST_INCLUDE;
}>;

export function toGuestDto(guest: GuestWithRelations): GuestProfileDto {
  return {
    id: guest.id,
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email,
    phone: guest.phone,
    preferences: guest.preferences,
    notes: guest.notes,
    isVip: guest.isVip,
    isBlacklisted: guest.isBlacklisted,
    createdAt: guest.createdAt.toISOString(),
    updatedAt: guest.updatedAt.toISOString(),
  };
}

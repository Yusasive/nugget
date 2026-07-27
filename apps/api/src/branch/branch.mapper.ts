import type { BranchDto } from '@nugget/shared-types';
import type { Branch } from '../generated/prisma/client';

export function toBranchDto(branch: Branch): BranchDto {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    phone: branch.phone,
    email: branch.email,
    isActive: branch.isActive,
    standardCheckInTime: branch.standardCheckInTime,
    standardCheckOutTime: branch.standardCheckOutTime,
    earlyCheckInFeeAmount: branch.earlyCheckInFeeAmount
      ? branch.earlyCheckInFeeAmount.toString()
      : null,
    lateCheckOutFeeAmount: branch.lateCheckOutFeeAmount
      ? branch.lateCheckOutFeeAmount.toString()
      : null,
    createdAt: branch.createdAt.toISOString(),
    updatedAt: branch.updatedAt.toISOString(),
  };
}

export const RATE_PLAN_TYPES = ["STANDARD", "SEASONAL", "CORPORATE", "PROMOTIONAL"] as const;
export type RatePlanType = (typeof RATE_PLAN_TYPES)[number];

export interface RatePlanDto {
  id: string;
  branchId: string;
  roomTypeId: string;
  name: string;
  type: RatePlanType;
  /** Decimal serialized as a string over the wire to avoid float rounding. */
  pricePerNight: string;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
}

export interface CreateRatePlanRequestBody {
  roomTypeId: string;
  name: string;
  type: RatePlanType;
  pricePerNight: string;
  validFrom?: string;
  validTo?: string;
}

export interface UpdateRatePlanRequestBody {
  name?: string;
  type?: RatePlanType;
  pricePerNight?: string;
  validFrom?: string;
  validTo?: string;
  isActive?: boolean;
}

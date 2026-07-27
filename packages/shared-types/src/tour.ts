import type { PaginationQuery } from "./pagination";
import type { BookingSource, GuestDto, GuestInput } from "./booking";

// --- Catalog: TourGuide ---

export interface TourGuideDto {
  id: string;
  branchId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTourGuideRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  fullName: string;
  phone?: string;
  email?: string;
}

export interface UpdateTourGuideRequestBody {
  fullName?: string;
  phone?: string;
  email?: string;
  isActive?: boolean;
}

export interface ListTourGuidesQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

// --- Catalog: Vehicle ---

export interface VehicleDto {
  id: string;
  branchId: string;
  name: string;
  plateNumber: string | null;
  capacity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
  plateNumber?: string;
  capacity: number;
}

export interface UpdateVehicleRequestBody {
  name?: string;
  plateNumber?: string;
  capacity?: number;
  isActive?: boolean;
}

export interface ListVehiclesQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

// --- Catalog: TourPackage ---

export interface TourPackageDto {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  itinerary: string | null;
  durationMinutes: number;
  defaultPricePerSeat: string;
  defaultCapacity: number;
  imageUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTourPackageRequestBody {
  /** Honored for Super Admin only; every other role is forced to their own branch server-side. */
  branchId: string;
  name: string;
  description?: string;
  itinerary?: string;
  durationMinutes: number;
  defaultPricePerSeat: string;
  defaultCapacity: number;
  imageUrls?: string[];
}

export interface UpdateTourPackageRequestBody {
  name?: string;
  description?: string;
  itinerary?: string;
  durationMinutes?: number;
  defaultPricePerSeat?: string;
  defaultCapacity?: number;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface ListTourPackagesQuery extends PaginationQuery {
  search?: string;
  isActive?: boolean;
}

// --- TourDeparture ---

export const TOUR_DEPARTURE_STATUSES = [
  "SCHEDULED",
  "CANCELLED",
  "COMPLETED",
] as const;
export type TourDepartureStatus = (typeof TOUR_DEPARTURE_STATUSES)[number];

export interface TourDepartureDto {
  id: string;
  branchId: string;
  departureAt: string;
  returnAt: string;
  totalSeats: number;
  /** Computed at read time: totalSeats minus active (CONFIRMED or
   * not-yet-expired HELD) booking seats. Never stored — see schema.prisma. */
  availableSeats: number;
  pricePerSeat: string;
  status: TourDepartureStatus;
  notes: string | null;
  createdAt: string;
  tourPackage: { id: string; name: string; durationMinutes: number };
  guide: { id: string; fullName: string };
  vehicle: { id: string; name: string };
}

export interface CreateTourDepartureRequestBody {
  tourPackageId: string;
  guideId: string;
  vehicleId: string;
  departureAt: string;
  returnAt: string;
  /** Defaults to the package's defaultCapacity/defaultPricePerSeat when omitted. */
  totalSeats?: number;
  pricePerSeat?: string;
  notes?: string;
}

export interface ListTourDeparturesQuery extends PaginationQuery {
  tourPackageId?: string;
  status?: TourDepartureStatus;
  departureFrom?: string;
  departureTo?: string;
}

export interface PublicTourDeparturesQuery {
  tourPackageId: string;
}

// --- TourBooking ---

export const TOUR_BOOKING_STATUSES = [
  "HELD",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
] as const;
export type TourBookingStatus = (typeof TOUR_BOOKING_STATUSES)[number];

export interface TourBookingDto {
  id: string;
  branchId: string;
  seats: number;
  status: TourBookingStatus;
  holdExpiresAt: string | null;
  totalAmount: string;
  source: BookingSource;
  linkedBookingId: string | null;
  notes: string | null;
  createdAt: string;
  tourDeparture: TourDepartureDto;
  guest: GuestDto;
}

/** Staff-side creation: an existing guestId, or inline details for a new one. */
export interface CreateTourBookingRequestBody {
  tourDepartureId: string;
  seats: number;
  guestId?: string;
  guest?: GuestInput;
  linkedBookingId?: string;
  notes?: string;
}

/** Public/unauthenticated creation — branchId is explicit since there's no actor context to scope by. */
export interface CreatePublicTourBookingRequestBody {
  branchId: string;
  tourDepartureId: string;
  seats: number;
  guest: GuestInput;
  linkedBookingId?: string;
}

export interface ListTourBookingsQuery extends PaginationQuery {
  status?: TourBookingStatus;
  tourDepartureId?: string;
}

/** PRD §5.8's manifest view — the guest list for one departure. */
export interface TourManifestEntryDto {
  tourBookingId: string;
  seats: number;
  status: TourBookingStatus;
  guest: GuestDto;
  notes: string | null;
}

export interface TourManifestDto {
  tourDeparture: TourDepartureDto;
  entries: TourManifestEntryDto[];
  totalSeatsBooked: number;
}

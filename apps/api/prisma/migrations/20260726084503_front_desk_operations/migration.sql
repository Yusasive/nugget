-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('CLEAN', 'DIRTY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_OUT';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInByStaffId" TEXT,
ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutByStaffId" TEXT,
ADD COLUMN     "depositAmount" DECIMAL(10,2),
ADD COLUMN     "earlyCheckInFee" DECIMAL(10,2),
ADD COLUMN     "lateCheckOutFee" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "earlyCheckInFeeAmount" DECIMAL(10,2),
ADD COLUMN     "lateCheckOutFeeAmount" DECIMAL(10,2),
ADD COLUMN     "standardCheckInTime" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN     "standardCheckOutTime" TEXT NOT NULL DEFAULT '12:00';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "housekeepingStatus" "HousekeepingStatus" NOT NULL DEFAULT 'CLEAN';

-- CreateTable
CREATE TABLE "RoomTransfer" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "fromRoomId" TEXT NOT NULL,
    "toRoomId" TEXT NOT NULL,
    "reason" TEXT,
    "transferredByStaffId" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomTransfer_bookingId_idx" ON "RoomTransfer"("bookingId");

-- CreateIndex
CREATE INDEX "RoomTransfer_branchId_idx" ON "RoomTransfer"("branchId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_checkedInByStaffId_fkey" FOREIGN KEY ("checkedInByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_checkedOutByStaffId_fkey" FOREIGN KEY ("checkedOutByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomTransfer" ADD CONSTRAINT "RoomTransfer_transferredByStaffId_fkey" FOREIGN KEY ("transferredByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

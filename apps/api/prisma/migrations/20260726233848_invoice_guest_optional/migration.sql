-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_guestId_fkey";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "guestId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

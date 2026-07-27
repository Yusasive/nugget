-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_branchId_plateNumber_key" ON "Vehicle"("branchId", "plateNumber");

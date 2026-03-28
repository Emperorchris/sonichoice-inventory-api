/*
  Warnings:

  - You are about to drop the column `merchantId` on the `Parcel` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Parcel` DROP FOREIGN KEY `Parcel_merchantId_fkey`;

-- DropIndex
DROP INDEX `Parcel_merchantId_fkey` ON `Parcel`;

-- AlterTable
ALTER TABLE `Parcel` DROP COLUMN `merchantId`;

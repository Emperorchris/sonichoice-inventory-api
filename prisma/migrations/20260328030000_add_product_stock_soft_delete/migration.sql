-- Add soft delete columns to ProductStock
ALTER TABLE `ProductStock` ADD COLUMN `isDeleted` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `ProductStock` ADD COLUMN `deletedAt` DATETIME(3) NULL;

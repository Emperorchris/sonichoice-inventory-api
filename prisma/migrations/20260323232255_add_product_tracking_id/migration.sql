-- Add column as nullable first
ALTER TABLE `Product` ADD COLUMN `trackingId` TEXT;

-- Backfill existing rows
UPDATE `Product` p
JOIN `Merchant` m ON p.`merchantId` = m.`id`
SET p.`trackingId` = CONCAT(UPPER(LEFT(m.`name`, 4)), '-', YEAR(CURRENT_DATE), '-', UPPER(SUBSTRING(MD5(UUID()), 1, 8)));

-- Now make it required and unique
ALTER TABLE `Product` MODIFY COLUMN `trackingId` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `Product_trackingId_key` ON `Product`(`trackingId`);

-- CreateTable
CREATE TABLE `ProductStock` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `lowStockAlert` INTEGER NOT NULL DEFAULT 10,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductStock_productId_branchId_key`(`productId`, `branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Migrate existing product data into ProductStock (preserve quantity + branch)
INSERT INTO `ProductStock` (`id`, `productId`, `branchId`, `quantity`, `lowStockAlert`, `createdAt`, `updatedAt`)
SELECT UUID(), `id`, `branchId`, `quantity`, 10, NOW(3), NOW(3)
FROM `Product`
WHERE `branchId` IS NOT NULL;

-- Now safe to drop old columns
ALTER TABLE `Product` DROP FOREIGN KEY `Product_branchId_fkey`;
ALTER TABLE `Product` DROP COLUMN `branchId`;
ALTER TABLE `Product` DROP COLUMN `quantity`;

-- AddForeignKeys
ALTER TABLE `ProductStock` ADD CONSTRAINT `ProductStock_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ProductStock` ADD CONSTRAINT `ProductStock_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

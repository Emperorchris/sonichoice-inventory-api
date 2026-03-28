-- CreateTable
CREATE TABLE `Parcel` (
    `id` VARCHAR(191) NOT NULL,
    `trackingNumber` VARCHAR(191) NOT NULL,
    `merchantId` VARCHAR(191) NOT NULL,
    `size` ENUM('SMALL', 'MEDIUM', 'LARGE', 'EXTRA_LARGE') NULL,
    `fromBranchId` VARCHAR(191) NOT NULL,
    `toBranchId` VARCHAR(191) NOT NULL,
    `currentBranchId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `dateShipped` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dateDelivered` DATETIME(3) NULL,
    `additionalInfo` VARCHAR(3000) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Parcel_trackingNumber_key`(`trackingNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParcelItem` (
    `id` VARCHAR(191) NOT NULL,
    `parcelId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `ParcelItem_parcelId_productId_key`(`parcelId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKeys
ALTER TABLE `Parcel` ADD CONSTRAINT `Parcel_merchantId_fkey` FOREIGN KEY (`merchantId`) REFERENCES `Merchant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Parcel` ADD CONSTRAINT `Parcel_fromBranchId_fkey` FOREIGN KEY (`fromBranchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Parcel` ADD CONSTRAINT `Parcel_toBranchId_fkey` FOREIGN KEY (`toBranchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Parcel` ADD CONSTRAINT `Parcel_currentBranchId_fkey` FOREIGN KEY (`currentBranchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ParcelItem` ADD CONSTRAINT `ParcelItem_parcelId_fkey` FOREIGN KEY (`parcelId`) REFERENCES `Parcel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ParcelItem` ADD CONSTRAINT `ParcelItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Add column as nullable first
ALTER TABLE "Product" ADD COLUMN "trackingId" TEXT;

-- Backfill existing rows
UPDATE "Product" SET "trackingId" = CONCAT(UPPER(LEFT(m."name", 4)), '-', EXTRACT(YEAR FROM CURRENT_DATE)::TEXT, '-', UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 8)))
FROM "Merchant" m WHERE "Product"."merchantId" = m."id";

-- Now make it required and unique
ALTER TABLE "Product" ALTER COLUMN "trackingId" SET NOT NULL;
CREATE UNIQUE INDEX "Product_trackingId_key" ON "Product"("trackingId");

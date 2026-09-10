-- =============================================================================
-- ReWear Full Database Schema & Seed Data for Supabase PostgreSQL
-- Copy and run this entire script in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- =============================================================================

-- Drop existing tables & types if re-running
DROP TABLE IF EXISTS "Report" CASCADE;
DROP TABLE IF EXISTS "Review" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "Item" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

DROP TYPE IF EXISTS "ReportStatus" CASCADE;
DROP TYPE IF EXISTS "TransactionStatus" CASCADE;
DROP TYPE IF EXISTS "ItemStatus" CASCADE;
DROP TYPE IF EXISTS "ItemMode" CASCADE;

-- 1. Create Enums
CREATE TYPE "ItemMode" AS ENUM ('TRADE', 'DONATE', 'RENT');
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'PENDING', 'EXCHANGED');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'DECLINED', 'DISPUTED');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED');

-- 2. Create Tables

-- User Table
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "pointsBalance" INTEGER NOT NULL DEFAULT 50,
    "escrowBalance" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "verificationCode" TEXT,
    "verificationExpires" TIMESTAMP(3),
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Item Table
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "images" TEXT NOT NULL,
    "mode" "ItemMode" NOT NULL,
    "pointsValue" INTEGER NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Transaction Table
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "type" "ItemMode" NOT NULL,
    "pointsSpent" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "trackingNumber" TEXT,
    "carrier" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "estimatedDelivery" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Transaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Review Table
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Review_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Review_transactionId_key" ON "Review"("transactionId");

-- Report Table
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportedUserId" TEXT,
    "reportedItemId" TEXT,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Report_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reportedItemId_fkey" FOREIGN KEY ("reportedItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- =============================================================================
-- 3. Seed Initial Demo Data (Password for all users: password123)
-- bcrypt hash for 'password123': $2a$12$E.p11S43VdGv7kF2h96Rau.sD61vX5sQ9v.z1y7m1zX7e7a7e7a7e
-- =============================================================================

INSERT INTO "User" ("id", "name", "email", "passwordHash", "pointsBalance", "escrowBalance", "verified", "isAdmin", "rating", "createdAt") VALUES
('usr_admin', 'Admin Manager', 'admin@rewear.local', '$2a$12$E.p11S43VdGv7kF2h96Rau.sD61vX5sQ9v.z1y7m1zX7e7a7e7a7e', 500, 0, true, true, 5.0, NOW()),
('usr_maya', 'Maya Patel', 'maya@rewear.local', '$2a$12$E.p11S43VdGv7kF2h96Rau.sD61vX5sQ9v.z1y7m1zX7e7a7e7a7e', 180, 0, true, false, 4.8, NOW()),
('usr_alex', 'Alex Rivera', 'alex@rewear.local', '$2a$12$E.p11S43VdGv7kF2h96Rau.sD61vX5sQ9v.z1y7m1zX7e7a7e7a7e', 120, 0, true, false, 4.6, NOW()),
('usr_sophia', 'Sophia Chen', 'sophia@rewear.local', '$2a$12$E.p11S43VdGv7kF2h96Rau.sD61vX5sQ9v.z1y7m1zX7e7a7e7a7e', 50, 0, false, false, 5.0, NOW());

INSERT INTO "Item" ("id", "ownerId", "title", "description", "category", "size", "condition", "images", "mode", "pointsValue", "status", "createdAt") VALUES
('itm_1', 'usr_maya', 'Linen Summer Dress', 'A carefully loved linen summer dress, ready for its next story. Sustainable choice!', 'Dresses', 'M', 'Like new', '["https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80"]', 'DONATE', 32, 'AVAILABLE', NOW()),
('itm_2', 'usr_maya', 'Classic Denim Jacket', 'A carefully loved classic denim jacket, ready for its next story. Sustainable choice!', 'Outerwear', 'L', 'Good', '["https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80"]', 'TRADE', 28, 'AVAILABLE', NOW()),
('itm_3', 'usr_alex', 'Cream Knit Cardigan', 'A carefully loved cream knit cardigan, ready for its next story. Sustainable choice!', 'Knitwear', 'S', 'Excellent', '["https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=80"]', 'RENT', 20, 'AVAILABLE', NOW()),
('itm_4', 'usr_alex', 'Olive Cargo Trousers', 'A carefully loved olive cargo trousers, ready for its next story. Sustainable choice!', 'Bottoms', 'M', 'Good', '["https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80"]', 'TRADE', 24, 'AVAILABLE', NOW()),
('itm_5', 'usr_sophia', 'Vintage Floral Blouse', 'A carefully loved vintage floral blouse, ready for its next story. Sustainable choice!', 'Tops', 'S', 'Like new', '["https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=800&q=80"]', 'DONATE', 26, 'AVAILABLE', NOW()),
('itm_6', 'usr_maya', 'Navy Wool Coat', 'A carefully loved navy wool coat, ready for its next story. Sustainable choice!', 'Outerwear', 'M', 'Good', '["https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80"]', 'RENT', 38, 'AVAILABLE', NOW()),
('itm_7', 'usr_alex', 'Everyday White Shirt', 'A carefully loved everyday white shirt, ready for its next story. Sustainable choice!', 'Tops', 'L', 'Good', '["https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80"]', 'DONATE', 18, 'AVAILABLE', NOW()),
('itm_8', 'usr_sophia', 'Black Wide-Leg Jeans', 'A carefully loved black wide-leg jeans, ready for its next story. Sustainable choice!', 'Bottoms', 'M', 'Excellent', '["https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=80"]', 'TRADE', 30, 'AVAILABLE', NOW());

INSERT INTO "Transaction" ("id", "itemId", "fromUserId", "toUserId", "type", "pointsSpent", "status", "trackingNumber", "carrier", "shippedAt", "estimatedDelivery", "createdAt") VALUES
('tx_1', 'itm_2', 'usr_alex', 'usr_maya', 'TRADE', 28, 'SHIPPED', 'TRK-984210', 'BlueDart Courier', NOW(), NOW() + INTERVAL '2 days', NOW()),
('tx_2', 'itm_3', 'usr_maya', 'usr_alex', 'RENT', 20, 'COMPLETED', NULL, NULL, NULL, NULL, NOW());

INSERT INTO "Report" ("id", "reporterId", "reportedUserId", "reportedItemId", "reason", "status", "createdAt") VALUES
('rep_1', 'usr_alex', 'usr_sophia', 'itm_5', 'Inaccurate item description size details.', 'OPEN', NOW());

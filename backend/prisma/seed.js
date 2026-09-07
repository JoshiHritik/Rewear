import { PrismaClient, ItemMode, ItemStatus, TransactionStatus, ReportStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with fresh admin and demo data...');

  // Clean existing data first
  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.item.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('password123', 12);

  // 1. Create Admin User
  const admin = await prisma.user.create({
    data: {
      name: 'Admin Manager',
      email: 'admin@rewear.local',
      passwordHash: hash,
      verified: true,
      isAdmin: true,
      pointsBalance: 500,
      rating: 5.0
    }
  });

  // 2. Create Regular Demo Users
  const maya = await prisma.user.create({
    data: {
      name: 'Maya Patel',
      email: 'maya@rewear.local',
      passwordHash: hash,
      verified: true,
      isAdmin: false,
      pointsBalance: 180,
      rating: 4.8
    }
  });

  const alex = await prisma.user.create({
    data: {
      name: 'Alex Rivera',
      email: 'alex@rewear.local',
      passwordHash: hash,
      verified: true,
      isAdmin: false,
      pointsBalance: 120,
      rating: 4.6
    }
  });

  const sophia = await prisma.user.create({
    data: {
      name: 'Sophia Chen',
      email: 'sophia@rewear.local',
      passwordHash: hash,
      verified: false,
      isAdmin: false,
      pointsBalance: 50,
      rating: 5.0
    }
  });

  // 3. Create Sample Items
  const itemsData = [
    { title: 'Linen Summer Dress', category: 'Dresses', size: 'M', condition: 'Like new', mode: ItemMode.DONATE, pointsValue: 32, ownerId: maya.id, imgIdx: 0 },
    { title: 'Classic Denim Jacket', category: 'Outerwear', size: 'L', condition: 'Good', mode: ItemMode.TRADE, pointsValue: 28, ownerId: maya.id, imgIdx: 1 },
    { title: 'Cream Knit Cardigan', category: 'Knitwear', size: 'S', condition: 'Excellent', mode: ItemMode.RENT, pointsValue: 20, ownerId: alex.id, imgIdx: 2 },
    { title: 'Olive Cargo Trousers', category: 'Bottoms', size: 'M', condition: 'Good', mode: ItemMode.TRADE, pointsValue: 24, ownerId: alex.id, imgIdx: 3 },
    { title: 'Vintage Floral Blouse', category: 'Tops', size: 'S', condition: 'Like new', mode: ItemMode.DONATE, pointsValue: 26, ownerId: sophia.id, imgIdx: 4 },
    { title: 'Navy Wool Coat', category: 'Outerwear', size: 'M', condition: 'Good', mode: ItemMode.RENT, pointsValue: 38, ownerId: maya.id, imgIdx: 0 },
    { title: 'Everyday White Shirt', category: 'Tops', size: 'L', condition: 'Good', mode: ItemMode.DONATE, pointsValue: 18, ownerId: alex.id, imgIdx: 1 },
    { title: 'Black Wide-Leg Jeans', category: 'Bottoms', size: 'M', condition: 'Excellent', mode: ItemMode.TRADE, pointsValue: 30, ownerId: sophia.id, imgIdx: 2 },
    { title: 'Terracotta Midi Skirt', category: 'Bottoms', size: 'S', condition: 'Like new', mode: ItemMode.TRADE, pointsValue: 25, ownerId: maya.id, imgIdx: 3 },
    { title: 'Soft Grey Hoodie', category: 'Knitwear', size: 'XL', condition: 'Good', mode: ItemMode.DONATE, pointsValue: 20, ownerId: alex.id, imgIdx: 4 },
    { title: 'Yellow Rain Jacket', category: 'Outerwear', size: 'M', condition: 'Good', mode: ItemMode.RENT, pointsValue: 22, ownerId: sophia.id, imgIdx: 0 },
    { title: 'Striped Cotton Tee', category: 'Tops', size: 'S', condition: 'Excellent', mode: ItemMode.TRADE, pointsValue: 15, ownerId: maya.id, imgIdx: 1 }
  ];

  const unsplashPhotos = [
    'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=800&q=80'
  ];

  const createdItems = [];
  for (const item of itemsData) {
    const created = await prisma.item.create({
      data: {
        title: item.title,
        description: `A carefully loved ${item.title.toLowerCase()}, ready for its next story. Sustainable choice!`,
        category: item.category,
        size: item.size,
        condition: item.condition,
        mode: item.mode,
        pointsValue: item.pointsValue,
        status: ItemStatus.AVAILABLE,
        ownerId: item.ownerId,
        images: JSON.stringify([unsplashPhotos[item.imgIdx]])
      }
    });
    createdItems.push(created);
  }

  // 4. Create Sample Transactions
  const tx1 = await prisma.transaction.create({
    data: {
      itemId: createdItems[1].id, // Classic Denim Jacket
      fromUserId: alex.id,
      toUserId: maya.id,
      type: ItemMode.TRADE,
      pointsSpent: 28,
      status: TransactionStatus.SHIPPED,
      trackingNumber: 'TRK-984210',
      carrier: 'BlueDart Courier',
      shippedAt: new Date(),
      estimatedDelivery: new Date(Date.now() + 2 * 86400000)
    }
  });

  const tx2 = await prisma.transaction.create({
    data: {
      itemId: createdItems[2].id, // Cream Knit Cardigan
      fromUserId: maya.id,
      toUserId: alex.id,
      type: ItemMode.RENT,
      pointsSpent: 20,
      status: TransactionStatus.COMPLETED
    }
  });

  const tx3 = await prisma.transaction.create({
    data: {
      itemId: createdItems[4].id, // Vintage Floral Blouse
      fromUserId: alex.id,
      toUserId: sophia.id,
      type: ItemMode.DONATE,
      pointsSpent: 26,
      status: TransactionStatus.PENDING
    }
  });

  // 5. Create Sample Reports
  await prisma.report.create({
    data: {
      reporterId: alex.id,
      reportedUserId: sophia.id,
      reportedItemId: createdItems[4].id,
      reason: 'Inaccurate item description size details.',
      status: ReportStatus.OPEN
    }
  });

  await prisma.report.create({
    data: {
      reporterId: maya.id,
      reportedUserId: alex.id,
      reason: 'Delayed response on swap confirmation.',
      status: ReportStatus.OPEN
    }
  });

  console.log('Database seeding complete successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

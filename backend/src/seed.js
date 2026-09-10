import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getSupabaseClient, isSupabaseConfigured } from './supabase.js';

async function seed() {
  if (!isSupabaseConfigured()) {
    console.error('❌ Cannot seed database: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be configured in .env');
    console.log('💡 Tip: You can also copy and run backend/schema.sql in your Supabase Dashboard -> SQL Editor.');
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  console.log('🌱 Seeding Supabase database with fresh admin and demo data...');

  const hash = await bcrypt.hash('password123', 12);

  // 1. Delete existing data
  await supabase.from('Review').delete().neq('id', '');
  await supabase.from('Report').delete().neq('id', '');
  await supabase.from('Transaction').delete().neq('id', '');
  await supabase.from('Item').delete().neq('id', '');
  await supabase.from('User').delete().neq('id', '');

  // 2. Insert Users
  const usersToInsert = [
    { id: 'usr_admin', name: 'Admin Manager', email: 'admin@rewear.local', passwordHash: hash, verified: true, isAdmin: true, pointsBalance: 500, rating: 5.0 },
    { id: 'usr_maya', name: 'Maya Patel', email: 'maya@rewear.local', passwordHash: hash, verified: true, isAdmin: false, pointsBalance: 180, rating: 4.8 },
    { id: 'usr_alex', name: 'Alex Rivera', email: 'alex@rewear.local', passwordHash: hash, verified: true, isAdmin: false, pointsBalance: 120, rating: 4.6 },
    { id: 'usr_sophia', name: 'Sophia Chen', email: 'sophia@rewear.local', passwordHash: hash, verified: false, isAdmin: false, pointsBalance: 50, rating: 5.0 }
  ];

  const { error: userError } = await supabase.from('User').insert(usersToInsert);
  if (userError) console.error('Error inserting users:', userError.message);

  // 3. Insert Items
  const itemsToInsert = [
    { id: 'itm_1', ownerId: 'usr_maya', title: 'Linen Summer Dress', description: 'A carefully loved linen summer dress, ready for its next story.', category: 'Dresses', size: 'M', condition: 'Like new', mode: 'DONATE', pointsValue: 32, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_2', ownerId: 'usr_maya', title: 'Classic Denim Jacket', description: 'A carefully loved classic denim jacket, ready for its next story.', category: 'Outerwear', size: 'L', condition: 'Good', mode: 'TRADE', pointsValue: 28, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_3', ownerId: 'usr_alex', title: 'Cream Knit Cardigan', description: 'A carefully loved cream knit cardigan, ready for its next story.', category: 'Knitwear', size: 'S', condition: 'Excellent', mode: 'RENT', pointsValue: 20, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_4', ownerId: 'usr_alex', title: 'Olive Cargo Trousers', description: 'A carefully loved olive cargo trousers, ready for its next story.', category: 'Bottoms', size: 'M', condition: 'Good', mode: 'TRADE', pointsValue: 24, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_5', ownerId: 'usr_sophia', title: 'Vintage Floral Blouse', description: 'A carefully loved vintage floral blouse, ready for its next story.', category: 'Tops', size: 'S', condition: 'Like new', mode: 'DONATE', pointsValue: 26, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_6', ownerId: 'usr_maya', title: 'Navy Wool Coat', description: 'A carefully loved navy wool coat, ready for its next story.', category: 'Outerwear', size: 'M', condition: 'Good', mode: 'RENT', pointsValue: 38, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_7', ownerId: 'usr_alex', title: 'Everyday White Shirt', description: 'A carefully loved everyday white shirt, ready for its next story.', category: 'Tops', size: 'L', condition: 'Good', mode: 'DONATE', pointsValue: 18, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80']) },
    { id: 'itm_8', ownerId: 'usr_sophia', title: 'Black Wide-Leg Jeans', description: 'A carefully loved black wide-leg jeans, ready for its next story.', category: 'Bottoms', size: 'M', condition: 'Excellent', mode: 'TRADE', pointsValue: 30, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=80']) }
  ];

  const { error: itemError } = await supabase.from('Item').insert(itemsToInsert);
  if (itemError) console.error('Error inserting items:', itemError.message);

  // 4. Insert Transactions
  const transactionsToInsert = [
    { id: 'tx_1', itemId: 'itm_2', fromUserId: 'usr_alex', toUserId: 'usr_maya', type: 'TRADE', pointsSpent: 28, status: 'SHIPPED', trackingNumber: 'TRK-984210', carrier: 'BlueDart Courier' },
    { id: 'tx_2', itemId: 'itm_3', fromUserId: 'usr_maya', toUserId: 'usr_alex', type: 'RENT', pointsSpent: 20, status: 'COMPLETED' }
  ];

  const { error: txError } = await supabase.from('Transaction').insert(transactionsToInsert);
  if (txError) console.error('Error inserting transactions:', txError.message);

  // 5. Insert Reports
  const reportsToInsert = [
    { id: 'rep_1', reporterId: 'usr_alex', reportedUserId: 'usr_sophia', reportedItemId: 'itm_5', reason: 'Inaccurate item description size details.', status: 'OPEN' }
  ];

  const { error: repError } = await supabase.from('Report').insert(reportsToInsert);
  if (repError) console.error('Error inserting reports:', repError.message);

  console.log('✅ Supabase database seeded successfully!');
}

seed().catch(err => {
  console.error('Seed script error:', err);
  process.exit(1);
});

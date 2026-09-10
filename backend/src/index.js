import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';

import { isSupabaseConfigured, getSupabaseClient, uploadImageToSupabase } from './supabase.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(__dirname, '../uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch (err) {}

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

const uploadMemory = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')) });
const tokenFor = (user) => jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
const safeUser = ({ passwordHash, verificationCode, ...user }) => user;
const parseImages = (item) => ({ ...item, images: typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []) });

// -----------------------------------------------------------------------------
// In-Memory Fallback Data Store (Used when Supabase credentials are not present)
// -----------------------------------------------------------------------------
const defaultHash = bcrypt.hashSync('password123', 10);
const memUsers = [
  { id: 'usr_admin', name: 'Admin Manager', email: 'admin@rewear.local', passwordHash: defaultHash, verified: true, isAdmin: true, pointsBalance: 500, escrowBalance: 0, rating: 5.0, createdAt: new Date().toISOString() },
  { id: 'usr_maya', name: 'Maya Patel', email: 'maya@rewear.local', passwordHash: defaultHash, verified: true, isAdmin: false, pointsBalance: 180, escrowBalance: 0, rating: 4.8, createdAt: new Date().toISOString() },
  { id: 'usr_alex', name: 'Alex Rivera', email: 'alex@rewear.local', passwordHash: defaultHash, verified: true, isAdmin: false, pointsBalance: 120, escrowBalance: 0, rating: 4.6, createdAt: new Date().toISOString() },
  { id: 'usr_sophia', name: 'Sophia Chen', email: 'sophia@rewear.local', passwordHash: defaultHash, verified: false, isAdmin: false, pointsBalance: 50, escrowBalance: 0, rating: 5.0, createdAt: new Date().toISOString() }
];

const memItems = [
  { id: 'itm_1', ownerId: 'usr_maya', title: 'Linen Summer Dress', description: 'A carefully loved linen summer dress, ready for its next story.', category: 'Dresses', size: 'M', condition: 'Like new', mode: 'DONATE', pointsValue: 32, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80']), createdAt: new Date().toISOString() },
  { id: 'itm_2', ownerId: 'usr_maya', title: 'Classic Denim Jacket', description: 'A carefully loved classic denim jacket, ready for its next story.', category: 'Outerwear', size: 'L', condition: 'Good', mode: 'TRADE', pointsValue: 28, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80']), createdAt: new Date().toISOString() },
  { id: 'itm_3', ownerId: 'usr_alex', title: 'Cream Knit Cardigan', description: 'A carefully loved cream knit cardigan, ready for its next story.', category: 'Knitwear', size: 'S', condition: 'Excellent', mode: 'RENT', pointsValue: 20, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=800&q=80']), createdAt: new Date().toISOString() },
  { id: 'itm_4', ownerId: 'usr_alex', title: 'Olive Cargo Trousers', description: 'A carefully loved olive cargo trousers, ready for its next story.', category: 'Bottoms', size: 'M', condition: 'Good', mode: 'TRADE', pointsValue: 24, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=800&q=80']), createdAt: new Date().toISOString() },
  { id: 'itm_5', ownerId: 'usr_sophia', title: 'Vintage Floral Blouse', description: 'A carefully loved vintage floral blouse, ready for its next story.', category: 'Tops', size: 'S', condition: 'Like new', mode: 'DONATE', pointsValue: 26, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=800&q=80']), createdAt: new Date().toISOString() },
  { id: 'itm_6', ownerId: 'usr_maya', title: 'Navy Wool Coat', description: 'A carefully loved navy wool coat, ready for its next story.', category: 'Outerwear', size: 'M', condition: 'Good', mode: 'RENT', pointsValue: 38, status: 'AVAILABLE', images: JSON.stringify(['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80']), createdAt: new Date().toISOString() }
];

const memTransactions = [];
const memReviews = [];
const memReports = [];

// Helper functions for user lookup
async function findUserById(id) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('User').select('*').eq('id', id).single();
    return data;
  }
  return memUsers.find(u => u.id === id) || null;
}

async function findUserByEmail(email) {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('User').select('*').eq('email', email.toLowerCase()).single();
    return data;
  }
  return memUsers.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

// Auth Middleware
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

// Admin Auth Middleware
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const user = await findUserById(decoded.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isAdmin) {
      req.user = user;
      return next();
    }
    res.status(403).json({ error: 'Admin privileges required' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};

// Health Check
app.get('/', (_, res) => res.json({ message: 'ReWear API Server is running.', supabase: isSupabaseConfigured() ? 'Connected' : 'Local Mode', health: '/api/health' }));
app.get('/api/health', (_, res) => res.json({ ok: true, supabase: isSupabaseConfigured() }));

// -----------------------------------------------------------------------------
// Auth Endpoints
// -----------------------------------------------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email, and a 6+ character password are required.' });
  }

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const passwordHash = await bcrypt.hash(password, 12);

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    
    // 1. Register with Supabase Auth
    let authUserId = null;
    try {
      const { data: authData } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: { data: { name } }
      });
      if (authData?.user) authUserId = authData.user.id;
    } catch (err) {
      console.warn('Supabase Auth signUp info:', err.message);
    }

    const userId = authUserId || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser = {
      id: userId,
      name,
      email: email.toLowerCase(),
      passwordHash,
      pointsBalance: 50,
      escrowBalance: 0,
      verified: false,
      isAdmin: false,
      rating: 5.0,
      createdAt: new Date().toISOString()
    };

    // 2. Insert into public."User" table
    const { data, error } = await supabase.from('User').upsert(newUser, { onConflict: 'email' }).select().single();
    if (error) return res.status(500).json({ error: 'Supabase signup error: ' + error.message });
    return res.status(201).json({ token: tokenFor(data || newUser), user: safeUser(data || newUser) });
  } else {
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name,
      email: email.toLowerCase(),
      passwordHash,
      pointsBalance: 50,
      escrowBalance: 0,
      verified: false,
      isAdmin: false,
      rating: 5.0,
      createdAt: new Date().toISOString()
    };
    memUsers.push(newUser);
    return res.status(201).json({ token: tokenFor(newUser), user: safeUser(newUser) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email || '');
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ token: tokenFor(user), user: safeUser(user) });
});

app.get('/api/auth/me', auth, (req, res) => res.json(safeUser(req.user)));

app.post('/api/auth/verify', auth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('User').update({ verified: true, verificationCode: null, verificationExpires: null }).eq('id', req.user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(safeUser(data));
  } else {
    req.user.verified = true;
    req.user.verificationCode = null;
    req.user.verificationExpires = null;
    return res.json(safeUser(req.user));
  }
});

app.post('/api/auth/send-verification', auth, async (req, res) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    await supabase.from('User').update({ verificationCode: code, verificationExpires: expires }).eq('id', req.user.id);
  } else {
    req.user.verificationCode = code;
    req.user.verificationExpires = expires;
  }

  res.json({
    success: true,
    message: 'Demo verification email sent!',
    preview: {
      to: req.user.email,
      name: req.user.name,
      code,
      subject: '🔐 Your ReWear Verification Code',
      sentAt: new Date().toISOString()
    }
  });
});

app.post('/api/auth/verify-code', auth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Verification code is required.' });
  if (!req.user.verificationCode || req.user.verificationCode !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your demo inbox.' });
  }

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('User').update({ verified: true, verificationCode: null, verificationExpires: null }).eq('id', req.user.id).select().single();
    return res.json(safeUser(data || req.user));
  } else {
    req.user.verified = true;
    req.user.verificationCode = null;
    req.user.verificationExpires = null;
    return res.json(safeUser(req.user));
  }
});

// -----------------------------------------------------------------------------
// Items Endpoints
// -----------------------------------------------------------------------------
app.get('/api/items', async (req, res) => {
  const { category, size, mode, q } = req.query;

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    let query = supabase.from('Item').select('*, owner:ownerId(id, name, verified, rating)').eq('status', 'AVAILABLE');
    if (category) query = query.eq('category', category);
    if (size) query = query.eq('size', size);
    if (mode) query = query.eq('mode', mode);
    if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
    query = query.order('createdAt', { ascending: false });
    
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map(parseImages));
  } else {
    let items = memItems.filter(i => i.status === 'AVAILABLE');
    if (category) items = items.filter(i => i.category === category);
    if (size) items = items.filter(i => i.size === size);
    if (mode) items = items.filter(i => i.mode === mode);
    if (q) {
      const lq = q.toLowerCase();
      items = items.filter(i => i.title.toLowerCase().includes(lq) || i.description.toLowerCase().includes(lq));
    }
    const result = items.map(i => {
      const owner = memUsers.find(u => u.id === i.ownerId) || {};
      return { ...parseImages(i), owner: { id: owner.id, name: owner.name, verified: owner.verified, rating: owner.rating } };
    });
    return res.json(result);
  }
});

app.get('/api/items/:id', async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('Item').select('*, owner:ownerId(id, name, verified, rating)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Item not found' });
    return res.json(parseImages(data));
  } else {
    const item = memItems.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const owner = memUsers.find(u => u.id === item.ownerId) || {};
    return res.json({ ...parseImages(item), owner: { id: owner.id, name: owner.name, verified: owner.verified, rating: owner.rating } });
  }
});

app.post('/api/items', auth, uploadMemory.array('images', 5), async (req, res) => {
  const { title, description, category, size, condition, mode, pointsValue } = req.body;
  if (!title || !description || !category || !size || !condition || !['TRADE', 'DONATE', 'RENT'].includes(mode)) {
    return res.status(400).json({ error: 'Please complete all listing fields.' });
  }

  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    if (isSupabaseConfigured()) {
      try {
        imageUrls = await Promise.all(
          req.files.map(f => uploadImageToSupabase(f.buffer, f.originalname, f.mimetype))
        );
      } catch (err) {
        console.error('Supabase upload fallback:', err);
        imageUrls = req.files.map(f => {
          const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(f.originalname || '.jpg')}`;
          fs.writeFileSync(path.join(uploadsDir, filename), f.buffer);
          return `/uploads/${filename}`;
        });
      }
    } else {
      imageUrls = req.files.map(f => {
        const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(f.originalname || '.jpg')}`;
        fs.writeFileSync(path.join(uploadsDir, filename), f.buffer);
        return `/uploads/${filename}`;
      });
    }
  }

  const newItem = {
    id: `itm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ownerId: req.user.id,
    title,
    description,
    category,
    size,
    condition,
    mode,
    pointsValue: Number(pointsValue) || 0,
    status: 'AVAILABLE',
    images: JSON.stringify(imageUrls),
    createdAt: new Date().toISOString()
  };

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('Item').insert(newItem).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(parseImages(data));
  } else {
    memItems.push(newItem);
    return res.status(201).json(parseImages(newItem));
  }
});

app.delete('/api/items/:id', auth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data: item } = await supabase.from('Item').select('id, ownerId').eq('id', req.params.id).single();
    if (!item || item.ownerId !== req.user.id) return res.status(404).json({ error: 'Listing not found' });
    await supabase.from('Item').delete().eq('id', item.id);
    return res.status(204).end();
  } else {
    const index = memItems.findIndex(i => i.id === req.params.id && i.ownerId === req.user.id);
    if (index === -1) return res.status(404).json({ error: 'Listing not found' });
    memItems.splice(index, 1);
    return res.status(204).end();
  }
});

// -----------------------------------------------------------------------------
// Transactions Endpoints
// -----------------------------------------------------------------------------
app.post('/api/transactions/request/:itemId', auth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data: item } = await supabase.from('Item').select('*').eq('id', req.params.itemId).single();
    if (!item || item.status !== 'AVAILABLE' || item.ownerId === req.user.id) return res.status(400).json({ error: 'This item cannot be requested.' });
    const tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      itemId: item.id,
      fromUserId: req.user.id,
      toUserId: item.ownerId,
      type: item.mode,
      pointsSpent: item.pointsValue,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    const { data, error } = await supabase.from('Transaction').insert(tx).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } else {
    const item = memItems.find(i => i.id === req.params.itemId);
    if (!item || item.status !== 'AVAILABLE' || item.ownerId === req.user.id) return res.status(400).json({ error: 'This item cannot be requested.' });
    const tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      itemId: item.id,
      fromUserId: req.user.id,
      toUserId: item.ownerId,
      type: item.mode,
      pointsSpent: item.pointsValue,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    memTransactions.push(tx);
    return res.status(201).json(tx);
  }
});

app.get('/api/transactions/mine', auth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('Transaction')
      .select('*, item:itemId(*), fromUser:fromUserId(id, name), toUser:toUserId(id, name)')
      .or(`fromUserId.eq.${req.user.id},toUserId.eq.${req.user.id}`)
      .order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json((data || []).map(t => ({ ...t, item: t.item ? parseImages(t.item) : null })));
  } else {
    const txs = memTransactions.filter(t => t.fromUserId === req.user.id || t.toUserId === req.user.id);
    const result = txs.map(t => {
      const item = memItems.find(i => i.id === t.itemId);
      const fromUser = memUsers.find(u => u.id === t.fromUserId);
      const toUser = memUsers.find(u => u.id === t.toUserId);
      return {
        ...t,
        item: item ? parseImages(item) : null,
        fromUser: fromUser ? { id: fromUser.id, name: fromUser.name } : null,
        toUser: toUser ? { id: toUser.id, name: toUser.name } : null
      };
    });
    return res.json(result);
  }
});

// -----------------------------------------------------------------------------
// Profile & User Dashboard Endpoints
// -----------------------------------------------------------------------------
app.get('/api/profiles/:id', async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase.from('User').select('id, name, verified, rating, createdAt').eq('id', req.params.id).single();
    if (error || !user) return res.status(404).json({ error: 'User not found' });
    const { data: items } = await supabase.from('Item').select('*').eq('ownerId', user.id).eq('status', 'AVAILABLE').order('createdAt', { ascending: false });
    return res.json({ ...user, items: (items || []).map(parseImages) });
  } else {
    const user = memUsers.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const items = memItems.filter(i => i.ownerId === user.id && i.status === 'AVAILABLE');
    return res.json({ id: user.id, name: user.name, verified: user.verified, rating: user.rating, createdAt: user.createdAt, items: items.map(parseImages) });
  }
});

app.get('/api/dashboard', auth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const [itemsRes, txRes, reportsRes] = await Promise.all([
      supabase.from('Item').select('*').eq('ownerId', req.user.id).order('createdAt', { ascending: false }),
      supabase.from('Transaction').select('*, item:itemId(*), fromUser:fromUserId(id, name), toUser:toUserId(id, name)').or(`fromUserId.eq.${req.user.id},toUserId.eq.${req.user.id}`).order('createdAt', { ascending: false }),
      supabase.from('Report').select('id', { count: 'exact', head: true }).eq('reportedUserId', req.user.id).eq('status', 'OPEN')
    ]);
    const items = (itemsRes.data || []).map(parseImages);
    const transactions = (txRes.data || []).map(t => ({ ...t, item: t.item ? parseImages(t.item) : null }));
    const openReports = reportsRes.count || 0;
    return res.json({ user: safeUser(req.user), items, transactions, openReports, manualReview: openReports >= 3 });
  } else {
    const items = memItems.filter(i => i.ownerId === req.user.id).map(parseImages);
    const transactions = memTransactions.filter(t => t.fromUserId === req.user.id || t.toUserId === req.user.id).map(t => {
      const item = memItems.find(i => i.id === t.itemId);
      const fromUser = memUsers.find(u => u.id === t.fromUserId);
      const toUser = memUsers.find(u => u.id === t.toUserId);
      return { ...t, item: item ? parseImages(item) : null, fromUser: fromUser ? { id: fromUser.id, name: fromUser.name } : null, toUser: toUser ? { id: toUser.id, name: toUser.name } : null };
    });
    const openReports = memReports.filter(r => r.reportedUserId === req.user.id && r.status === 'OPEN').length;
    return res.json({ user: safeUser(req.user), items, transactions, openReports, manualReview: openReports >= 3 });
  }
});

// -----------------------------------------------------------------------------
// Admin Endpoints
// -----------------------------------------------------------------------------
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const [u, i, ai, t, ct, r] = await Promise.all([
      supabase.from('User').select('id', { count: 'exact', head: true }),
      supabase.from('Item').select('id', { count: 'exact', head: true }),
      supabase.from('Item').select('id', { count: 'exact', head: true }).eq('status', 'AVAILABLE'),
      supabase.from('Transaction').select('id', { count: 'exact', head: true }),
      supabase.from('Transaction').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED'),
      supabase.from('Report').select('id', { count: 'exact', head: true }).eq('status', 'OPEN')
    ]);
    return res.json({
      totalUsers: u.count || 0,
      totalItems: i.count || 0,
      activeItems: ai.count || 0,
      totalTransactions: t.count || 0,
      completedSwaps: ct.count || 0,
      openReports: r.count || 0,
      totalPoints: 850
    });
  } else {
    return res.json({
      totalUsers: memUsers.length,
      totalItems: memItems.length,
      activeItems: memItems.filter(i => i.status === 'AVAILABLE').length,
      totalTransactions: memTransactions.length,
      completedSwaps: memTransactions.filter(t => t.status === 'COMPLETED').length,
      openReports: memReports.filter(r => r.status === 'OPEN').length,
      totalPoints: memUsers.reduce((sum, u) => sum + (u.pointsBalance || 0), 0)
    });
  }
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('User').select('*').order('createdAt', { ascending: false });
    return res.json((data || []).map(safeUser));
  } else {
    return res.json(memUsers.map(safeUser));
  }
});

app.get('/api/admin/items', adminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('Item').select('*, owner:ownerId(id, name, email)').order('createdAt', { ascending: false });
    return res.json((data || []).map(parseImages));
  } else {
    return res.json(memItems.map(i => {
      const owner = memUsers.find(u => u.id === i.ownerId);
      return { ...parseImages(i), owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null };
    }));
  }
});

app.get('/api/admin/transactions', adminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('Transaction')
      .select('*, item:itemId(id, title, images), fromUser:fromUserId(id, name, email), toUser:toUserId(id, name, email)')
      .order('createdAt', { ascending: false });
    return res.json((data || []).map(t => ({ ...t, item: t.item ? parseImages(t.item) : null })));
  } else {
    return res.json(memTransactions.map(t => {
      const item = memItems.find(i => i.id === t.itemId);
      const fromUser = memUsers.find(u => u.id === t.fromUserId);
      const toUser = memUsers.find(u => u.id === t.toUserId);
      return {
        ...t,
        item: item ? parseImages(item) : null,
        fromUser: fromUser ? { id: fromUser.id, name: fromUser.name, email: fromUser.email } : null,
        toUser: toUser ? { id: toUser.id, name: toUser.name, email: toUser.email } : null
      };
    }));
  }
});

app.get('/api/admin/reports', adminAuth, async (req, res) => {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    const { data } = await supabase.from('Report')
      .select('*, reporter:reporterId(id, name, email), reportedUser:reportedUserId(id, name, email), reportedItem:reportedItemId(id, title)')
      .order('createdAt', { ascending: false });
    return res.json(data || []);
  } else {
    return res.json(memReports);
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({ error: 'Internal server error: ' + (err.message || 'Something went wrong.') });
});

if (!process.env.VERCEL) {
  app.listen(process.env.PORT || 4000, () => console.log('🚀 ReWear API running on port ' + (process.env.PORT || 4000)));
}

export default app;

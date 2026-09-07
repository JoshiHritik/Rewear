import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { PrismaClient, ItemMode, ItemStatus, TransactionStatus, ReportStatus } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));
const storage = multer.diskStorage({ destination: uploadsDir, filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`) });
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_, file, cb) => cb(null, file.mimetype.startsWith('image/')) });
const tokenFor = (user) => jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
const auth = async (req, res, next) => { try { req.user = await prisma.user.findUniqueOrThrow({ where: { id: jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET || 'dev-secret').id } }); next(); } catch { res.status(401).json({ error: 'Authentication required' }); } };
const safeUser = ({ passwordHash, ...user }) => user;
const parseImages = (item) => ({ ...item, images: JSON.parse(item.images || '[]') });

app.get('/', (_, res) => res.json({ message: 'ReWear API Server is running. Visit http://localhost:5173 for the Web App UI.', health: '/api/health' }));
app.get('/api/health', (_, res) => res.json({ ok: true }));
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ error: 'Name, email, and a 6+ character password are required.' });
  try { const user = await prisma.user.create({ data: { name, email: email.toLowerCase(), passwordHash: await bcrypt.hash(password, 12) } }); res.status(201).json({ token: tokenFor(user), user: safeUser(user) }); }
  catch { res.status(409).json({ error: 'An account with that email already exists.' }); }
});
app.post('/api/auth/login', async (req, res) => { const user = await prisma.user.findUnique({ where: { email: req.body.email?.toLowerCase() } }); if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password.' }); res.json({ token: tokenFor(user), user: safeUser(user) }); });
app.get('/api/auth/me', auth, (req, res) => res.json(safeUser(req.user)));
app.post('/api/auth/verify', auth, async (req, res) => res.json(safeUser(await prisma.user.update({ where: { id: req.user.id }, data: { verified: true, verificationCode: null, verificationExpires: null } }))));
app.post('/api/auth/send-verification', auth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({ where: { id: req.user.id }, data: { verificationCode: code, verificationExpires: expires } });
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to send verification email.' });
  }
});
app.post('/api/auth/verify-code', auth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Verification code is required.' });
  const user = req.user;
  if (!user.verificationCode || user.verificationCode !== code.trim()) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your demo inbox.' });
  }
  if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
    return res.status(400).json({ error: 'Verification code expired. Please request a new code.' });
  }
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { verified: true, verificationCode: null, verificationExpires: null }
  });
  res.json(safeUser(updatedUser));
});

app.get('/api/items', async (req, res) => { const { category, size, mode, q } = req.query; const where = { status: ItemStatus.AVAILABLE, ...(category ? { category } : {}), ...(size ? { size } : {}), ...(mode ? { mode } : {}), ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }] } : {}) }; const items = await prisma.item.findMany({ where, include: { owner: { select: { id: true, name: true, verified: true, rating: true } } }, orderBy: { createdAt: 'desc' } }); res.json(items.map(parseImages)); });
app.get('/api/items/:id', async (req, res) => { const item = await prisma.item.findUnique({ where: { id: req.params.id }, include: { owner: { select: { id: true, name: true, verified: true, rating: true } } } }); if (!item) return res.status(404).json({ error: 'Item not found' }); res.json(parseImages(item)); });
app.post('/api/items', auth, upload.array('images', 5), async (req, res) => { const { title, description, category, size, condition, mode, pointsValue } = req.body; if (!title || !description || !category || !size || !condition || !Object.values(ItemMode).includes(mode)) return res.status(400).json({ error: 'Please complete all listing fields.' }); const files = req.files?.map(f => `/uploads/${f.filename}`) || []; const item = await prisma.item.create({ data: { ownerId: req.user.id, title, description, category, size, condition, mode, pointsValue: Number(pointsValue) || 0, images: JSON.stringify(files) } }); res.status(201).json(parseImages(item)); });
app.patch('/api/items/:id', auth, async (req, res) => { const item = await prisma.item.findUnique({ where: { id: req.params.id } }); if (!item || item.ownerId !== req.user.id) return res.status(404).json({ error: 'Listing not found' }); const updated = await prisma.item.update({ where: { id: item.id }, data: req.body }); res.json(parseImages(updated)); });
app.delete('/api/items/:id', auth, async (req, res) => { const item = await prisma.item.findUnique({ where: { id: req.params.id } }); if (!item || item.ownerId !== req.user.id) return res.status(404).json({ error: 'Listing not found' }); await prisma.item.delete({ where: { id: item.id } }); res.status(204).end(); });

app.post('/api/transactions/request/:itemId', auth, async (req, res) => { const item = await prisma.item.findUnique({ where: { id: req.params.itemId } }); if (!item || item.status !== ItemStatus.AVAILABLE || item.ownerId === req.user.id) return res.status(400).json({ error: 'This item cannot be requested.' }); const tx = await prisma.transaction.create({ data: { itemId: item.id, fromUserId: req.user.id, toUserId: item.ownerId, type: item.mode, pointsSpent: item.pointsValue } }); res.status(201).json(tx); });
app.post('/api/transactions/:id/accept', auth, async (req, res) => { const tx = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { item: true, fromUser: true } }); if (!tx || tx.toUserId !== req.user.id || tx.status !== TransactionStatus.PENDING) return res.status(400).json({ error: 'Transaction cannot be accepted.' }); if (tx.fromUser.pointsBalance < tx.pointsSpent) return res.status(400).json({ error: 'Requester no longer has enough points.' }); await prisma.$transaction([prisma.user.update({ where: { id: tx.fromUserId }, data: { pointsBalance: { decrement: tx.pointsSpent }, escrowBalance: { increment: tx.pointsSpent } } }), prisma.item.update({ where: { id: tx.itemId }, data: { status: ItemStatus.PENDING } }), prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.CONFIRMED } })]); res.json({ ok: true }); });
app.post('/api/transactions/:id/decline', auth, async (req, res) => { const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } }); if (!tx || tx.toUserId !== req.user.id || tx.status !== TransactionStatus.PENDING) return res.status(400).json({ error: 'Transaction cannot be declined.' }); res.json(await prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.DECLINED } })); });
app.post('/api/transactions/:id/ship', auth, async (req, res) => {
  const { trackingNumber, carrier, estimatedDays } = req.body;
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!tx || tx.toUserId !== req.user.id || ![TransactionStatus.CONFIRMED, TransactionStatus.SHIPPED].includes(tx.status)) {
    return res.status(400).json({ error: 'Transaction cannot be marked as shipped.' });
  }
  const estDate = estimatedDays ? new Date(Date.now() + Number(estimatedDays) * 86400000) : new Date(Date.now() + 3 * 86400000);
  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      status: TransactionStatus.SHIPPED,
      trackingNumber: trackingNumber || ('TRK-' + Math.floor(100000 + Math.random() * 900000)),
      carrier: carrier || 'Standard Courier Delivery',
      shippedAt: new Date(),
      estimatedDelivery: estDate
    },
    include: { item: true, fromUser: { select: { id: true, name: true, email: true } }, toUser: { select: { id: true, name: true, email: true } } }
  });
  res.json({ ...updated, item: parseImages(updated.item) });
});
app.post('/api/transactions/:id/deliver', auth, async (req, res) => {
  const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!tx || ![tx.fromUserId, tx.toUserId].includes(req.user.id) || ![TransactionStatus.SHIPPED, TransactionStatus.IN_TRANSIT].includes(tx.status)) {
    return res.status(400).json({ error: 'Transaction cannot be marked as delivered.' });
  }
  const updated = await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: TransactionStatus.DELIVERED, deliveredAt: new Date() },
    include: { item: true, fromUser: { select: { id: true, name: true, email: true } }, toUser: { select: { id: true, name: true, email: true } } }
  });
  res.json({ ...updated, item: parseImages(updated.item) });
});
app.post('/api/transactions/:id/confirm', auth, async (req, res) => { const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } }); if (!tx || tx.fromUserId !== req.user.id || ![TransactionStatus.CONFIRMED, TransactionStatus.SHIPPED, TransactionStatus.IN_TRANSIT, TransactionStatus.DELIVERED].includes(tx.status)) return res.status(400).json({ error: 'Transaction cannot be confirmed.' }); const bonus = tx.type === 'DONATE' ? 10 : 0; await prisma.$transaction([prisma.user.update({ where: { id: tx.fromUserId }, data: { escrowBalance: { decrement: tx.pointsSpent } } }), prisma.user.update({ where: { id: tx.toUserId }, data: { pointsBalance: { increment: tx.pointsSpent + bonus } } }), prisma.item.update({ where: { id: tx.itemId }, data: { status: ItemStatus.EXCHANGED } }), prisma.transaction.update({ where: { id: tx.id }, data: { status: TransactionStatus.COMPLETED } })]); res.json({ ok: true }); });
app.get('/api/transactions/mine', auth, async (req, res) => { const txs = await prisma.transaction.findMany({ where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }] }, include: { item: true, fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }); res.json(txs.map(t => ({ ...t, item: parseImages(t.item) }))); });

app.post('/api/reviews', auth, async (req, res) => { const { transactionId, rating, comment } = req.body; const tx = await prisma.transaction.findUnique({ where: { id: transactionId } }); if (!tx || tx.status !== TransactionStatus.COMPLETED || ![tx.fromUserId, tx.toUserId].includes(req.user.id)) return res.status(400).json({ error: 'Review unavailable.' }); const revieweeId = tx.fromUserId === req.user.id ? tx.toUserId : tx.fromUserId; const review = await prisma.review.create({ data: { transactionId, reviewerId: req.user.id, revieweeId, rating: Number(rating), comment } }); const avg = await prisma.review.aggregate({ where: { revieweeId }, _avg: { rating: true } }); await prisma.user.update({ where: { id: revieweeId }, data: { rating: avg._avg.rating || 0 } }); res.status(201).json(review); });
app.post('/api/reports', auth, async (req, res) => { const { reportedUserId, reportedItemId, reason } = req.body; if (!reason || (!reportedUserId && !reportedItemId)) return res.status(400).json({ error: 'A report target and reason are required.' }); const report = await prisma.report.create({ data: { reporterId: req.user.id, reportedUserId, reportedItemId, reason } }); res.status(201).json(report); });
app.get('/api/profiles/:id', async (req, res) => { const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, name: true, verified: true, rating: true, createdAt: true, items: { where: { status: ItemStatus.AVAILABLE }, orderBy: { createdAt: 'desc' } } } }); if (!user) return res.status(404).json({ error: 'User not found' }); res.json({ ...user, items: user.items.map(parseImages) }); });
app.get('/api/dashboard', auth, async (req, res) => { const [items, transactions, reports] = await Promise.all([prisma.item.findMany({ where: { ownerId: req.user.id }, orderBy: { createdAt: 'desc' } }), prisma.transaction.findMany({ where: { OR: [{ fromUserId: req.user.id }, { toUserId: req.user.id }] }, include: { item: true, fromUser: { select: { id: true, name: true } }, toUser: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' } }), prisma.report.count({ where: { reportedUserId: req.user.id, status: 'OPEN' } })]); res.json({ user: safeUser(req.user), items: items.map(parseImages), transactions: transactions.map(t => ({ ...t, item: parseImages(t.item) })), openReports: reports, manualReview: reports >= 3 }); });
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const decoded = jwt.verify(authHeader.replace('Bearer ', ''), process.env.JWT_SECRET || 'dev-secret');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isAdmin) {
      req.user = user;
      return next();
    }
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount === 0) {
      const updatedAdmin = await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
      req.user = updatedAdmin;
      return next();
    }
    res.status(403).json({ error: 'Admin privileges required' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired admin token' });
  }
};

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const [totalUsers, totalItems, activeItems, totalTransactions, completedSwaps, openReports, pointsAggregate] = await Promise.all([
    prisma.user.count(),
    prisma.item.count(),
    prisma.item.count({ where: { status: ItemStatus.AVAILABLE } }),
    prisma.transaction.count(),
    prisma.transaction.count({ where: { status: TransactionStatus.COMPLETED } }),
    prisma.report.count({ where: { status: ReportStatus.OPEN } }),
    prisma.user.aggregate({ _sum: { pointsBalance: true } })
  ]);
  res.json({
    totalUsers,
    totalItems,
    activeItems,
    totalTransactions,
    completedSwaps,
    openReports,
    totalPoints: pointsAggregate._sum.pointsBalance || 0
  });
});

app.get('/api/admin/users', adminAuth, async (req, res) => {
  const users = await prisma.user.findMany({
    include: {
      _count: { select: { items: true, sentTransactions: true, receivedTransactions: true, reportsAgainst: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(users.map(safeUser));
});

app.patch('/api/admin/users/:id', adminAuth, async (req, res) => {
  const { pointsBalance, verified, isAdmin, name, email } = req.body;
  const updateData = {};
  if (pointsBalance !== undefined) updateData.pointsBalance = Number(pointsBalance);
  if (verified !== undefined) updateData.verified = Boolean(verified);
  if (isAdmin !== undefined) updateData.isAdmin = Boolean(isAdmin);
  if (name) updateData.name = name;
  if (email) updateData.email = email.toLowerCase();
  const updated = await prisma.user.update({ where: { id: req.params.id }, data: updateData });
  res.json(safeUser(updated));
});

app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  const targetId = req.params.id;
  if (req.user.id === targetId) {
    return res.status(400).json({ error: 'You cannot delete your own active admin account.' });
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { OR: [{ reviewerId: targetId }, { revieweeId: targetId }] } });
      await tx.report.deleteMany({ where: { OR: [{ reporterId: targetId }, { reportedUserId: targetId }] } });
      const userItems = await tx.item.findMany({ where: { ownerId: targetId }, select: { id: true } });
      const itemIds = userItems.map(i => i.id);
      if (itemIds.length > 0) {
        await tx.report.deleteMany({ where: { reportedItemId: { in: itemIds } } });
      }
      await tx.transaction.deleteMany({
        where: {
          OR: [
            { fromUserId: targetId },
            { toUserId: targetId },
            ...(itemIds.length > 0 ? [{ itemId: { in: itemIds } }] : [])
          ]
        }
      });
      await tx.item.deleteMany({ where: { ownerId: targetId } });
      await tx.user.delete({ where: { id: targetId } });
    });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

app.get('/api/admin/items', adminAuth, async (req, res) => {
  const items = await prisma.item.findMany({
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(items.map(parseImages));
});

app.delete('/api/admin/items/:id', adminAuth, async (req, res) => {
  const itemId = req.params.id;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.report.deleteMany({ where: { reportedItemId: itemId } });
      await tx.transaction.deleteMany({ where: { itemId } });
      await tx.item.delete({ where: { id: itemId } });
    });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item: ' + err.message });
  }
});

app.get('/api/admin/transactions', adminAuth, async (req, res) => {
  const txs = await prisma.transaction.findMany({
    include: {
      item: { select: { id: true, title: true, images: true } },
      fromUser: { select: { id: true, name: true, email: true } },
      toUser: { select: { id: true, name: true, email: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(txs.map(t => ({ ...t, item: parseImages(t.item) })));
});

app.get('/api/admin/reports', adminAuth, async (req, res) => {
  const reports = await prisma.report.findMany({
    include: {
      reporter: { select: { id: true, name: true, email: true } },
      reportedUser: { select: { id: true, name: true, email: true } },
      reportedItem: { select: { id: true, title: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(reports);
});

app.patch('/api/admin/reports/:id', adminAuth, async (req, res) => {
  const { status } = req.body;
  const updated = await prisma.report.update({
    where: { id: req.params.id },
    data: { status: status || 'REVIEWED' }
  });
  res.json(updated);
});

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong.' }); });
app.listen(process.env.PORT || 4000, () => console.log('ReWear API running on port ' + (process.env.PORT || 4000)));

import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Leaf, Search, Heart, ShieldCheck, Package, Plus, Star, Menu, X, ArrowRight, Recycle, Trash2, Users, Database, AlertTriangle, Activity, CheckCircle, Coins, Edit3, ShieldAlert, RefreshCw, Truck, MapPin, PackageCheck, CheckCircle2 } from 'lucide-react';
import './styles.css';
const API = 'http://localhost:4000/api';
const call = async (path, { token, ...opts } = {}) => { const r = await fetch(API + path, { ...opts, headers: { ...(opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) } }); const d = r.status === 204 ? null : await r.json(); if (!r.ok) throw new Error(d.error || 'Request failed'); return d };
const img = (item, index = 0) => { const file = item?.images?.[index] || item?.images?.[0]; if (!file) return 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80'; if (file.startsWith('http://') || file.startsWith('https://')) return file; return 'http://localhost:4000' + (file.startsWith('/') ? file : '/' + file) };

function DeliveryTrackerModal({ transaction, session, onClose, onRefresh }) {
  const [carrier, setCarrier] = useState(transaction.carrier || 'BlueDart Courier');
  const [trackingNumber, setTrackingNumber] = useState(transaction.trackingNumber || '');
  const [estimatedDays, setEstimatedDays] = useState(3);
  const [showShipModal, setShowShipModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const isOwner = session?.user?.id === transaction.toUserId;
  const isBuyer = session?.user?.id === transaction.fromUserId;

  const handleShip = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await call(`/transactions/${transaction.id}/ship`, {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ carrier, trackingNumber, estimatedDays })
      });
      setShowShipModal(false);
      onRefresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    try {
      await call(`/transactions/${transaction.id}/deliver`, { method: 'POST', token: session.token });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleConfirmArrival = async () => {
    try {
      await call(`/transactions/${transaction.id}/confirm`, { method: 'POST', token: session.token });
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const getStep = () => {
    switch (transaction.status) {
      case 'PENDING': return 1;
      case 'CONFIRMED': return 2;
      case 'SHIPPED':
      case 'IN_TRANSIT': return 3;
      case 'DELIVERED': return 4;
      case 'COMPLETED': return 5;
      default: return 0;
    }
  };

  const currentStep = getStep();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content tracker-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>

        <div className="modal-header">
          <Truck className="modal-title-icon" />
          <div>
            <h2>Order & Delivery Tracker</h2>
            <small>Item: <b>{transaction.item?.title}</b> ({transaction.type})</small>
          </div>
        </div>

        <div className="delivery-timeline">
          <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
            <div className="dot">1</div>
            <span>Request Sent</span>
          </div>
          <div className={`step-line ${currentStep >= 2 ? 'active' : ''}`}></div>
          <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
            <div className="dot">2</div>
            <span>Accepted</span>
          </div>
          <div className={`step-line ${currentStep >= 3 ? 'active' : ''}`}></div>
          <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
            <div className="dot">3</div>
            <span>Dispatched</span>
          </div>
          <div className={`step-line ${currentStep >= 4 ? 'active' : ''}`}></div>
          <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>
            <div className="dot">4</div>
            <span>Delivered</span>
          </div>
          <div className={`step-line ${currentStep >= 5 ? 'active' : ''}`}></div>
          <div className={`step ${currentStep >= 5 ? 'active' : ''}`}>
            <div className="dot">5</div>
            <span>Completed</span>
          </div>
        </div>

        <div className="tracker-details-box">
          <div className="tracker-row">
            <span>Current Status:</span>
            <b className={`status ${transaction.status.toLowerCase()}`}>{transaction.status.replace('_', ' ')}</b>
          </div>
          {transaction.trackingNumber && (
            <div className="tracker-row">
              <span>Carrier & Tracking:</span>
              <b>{transaction.carrier || 'Courier'} — <code>{transaction.trackingNumber}</code></b>
            </div>
          )}
          {transaction.shippedAt && (
            <div className="tracker-row">
              <span>Dispatched On:</span>
              <small>{new Date(transaction.shippedAt).toLocaleString()}</small>
            </div>
          )}
          {transaction.estimatedDelivery && transaction.status !== 'COMPLETED' && (
            <div className="tracker-row">
              <span>Estimated Delivery:</span>
              <small>{new Date(transaction.estimatedDelivery).toLocaleDateString()}</small>
            </div>
          )}
          <div className="tracker-row">
            <span>Swap Members:</span>
            <small>Seller: {transaction.toUser?.name} · Buyer: {transaction.fromUser?.name}</small>
          </div>
        </div>

        <div className="tracker-actions">
          {isOwner && transaction.status === 'CONFIRMED' && (
            <button className="btn" onClick={() => setShowShipModal(true)}>
              <PackageCheck size={16} /> Dispatch & Add Tracking Info
            </button>
          )}

          {isOwner && (transaction.status === 'SHIPPED' || transaction.status === 'IN_TRANSIT') && (
            <button className="btn" onClick={handleMarkDelivered}>
              <MapPin size={16} /> Mark as Delivered
            </button>
          )}

          {isBuyer && transaction.status !== 'COMPLETED' && transaction.status !== 'PENDING' && transaction.status !== 'DECLINED' && (
            <button className="btn" onClick={handleConfirmArrival}>
              <CheckCircle2 size={16} /> Confirm Receipt & Release Points
            </button>
          )}
        </div>

        {showShipModal && (
          <div className="dispatch-submodal">
            <h3>Enter Dispatch Details</h3>
            <form onSubmit={handleShip}>
              <label>
                Courier / Delivery Method
                <input
                  value={carrier}
                  onChange={e => setCarrier(e.target.value)}
                  placeholder="e.g. BlueDart, FedEx, Hand Delivery"
                  required
                />
              </label>
              <label>
                Tracking Number
                <input
                  value={trackingNumber}
                  onChange={e => setTrackingNumber(e.target.value)}
                  placeholder="e.g. TRK-984210"
                />
              </label>
              <label>
                Estimated Delivery (Days)
                <input
                  type="number"
                  min="1"
                  max="14"
                  value={estimatedDays}
                  onChange={e => setEstimatedDays(e.target.value)}
                />
              </label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button className="btn" disabled={loading}>{loading ? 'Updating...' : 'Dispatch Item'}</button>
                <button type="button" className="btn link-btn" onClick={() => setShowShipModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
function App() {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem('rewear-session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const update = (s) => {
    setSession(s);
    if (s) {
      localStorage.setItem('rewear-session', JSON.stringify(s));
    } else {
      localStorage.removeItem('rewear-session');
    }
  };

  useEffect(() => {
    if (session?.token) {
      call('/auth/me', { token: session.token })
        .then(user => {
          update({ token: session.token, user });
        })
        .catch(err => {
          if (err.message === 'Authentication required' || err.message?.includes('token')) {
            update(null);
          }
        });
    }
  }, []);

  return <><Nav session={session} logout={() => update(null)} /><main><Routes><Route path="/" element={<Landing />} /><Route path="/browse" element={<Browse />} /><Route path="/items/:id" element={<ItemDetail session={session} />} /><Route path="/login" element={<Auth onAuth={update} />} /><Route path="/signup" element={<Auth signup onAuth={update} />} /><Route path="/list" element={<Protected session={session}><ListItem session={session} /></Protected>} /><Route path="/dashboard" element={<Protected session={session}><Dashboard session={session} update={update} /></Protected>} /><Route path="/profile/:id" element={<Profile />} /><Route path="/admin" element={<Protected session={session}><AdminPanel session={session} /></Protected>} /><Route path="*" element={<Navigate to="/" />} /></Routes></main><footer>ReWear <span>·</span> Wear longer. Waste less.</footer></>
}
function Protected({ session, children }) { return session ? children : <Navigate to="/login" /> }
function Nav({ session, logout }) { const [open, setOpen] = useState(false); return <header><Link to="/" className="brand"><Leaf /> ReWear</Link><button className="mobile" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><nav className={open ? 'show' : ''}><Link to="/browse">Browse</Link>{session && <Link to="/list">List an item</Link>}{session ? <>{session?.user?.isAdmin && <Link to="/admin" className="admin-nav-link"><ShieldAlert size={14} /> Admin Panel</Link>}<Link to="/dashboard">Dashboard</Link><button onClick={logout} className="link">Log out</button></> : <><Link to="/login">Log in</Link><Link className="btn small" to="/signup">Join ReWear</Link></>}</nav></header> }
function Landing() { return <><section className="hero"><div><p className="eyebrow">A kinder way to dress</p><h1>Give great clothes a <i>second story.</i></h1><p className="lead">Trade, donate, and rent beautiful pre-loved pieces within your community — using points, never money.</p><div className="actions"><Link className="btn" to="/browse">Explore the wardrobe <ArrowRight /></Link><Link className="text-link" to="/list">List something you love</Link></div></div><div className="hero-image"><img src="https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1000&q=85" /><div className="floating"><Recycle /> <b>Every swap counts</b><span>Less waste. More style.</span></div></div></section><section className="stats"><div><b>15k+</b><span>pieces recirculated</span></div><div><b>42 tons</b><span>textiles kept in use</span></div><div><b>8.4k</b><span>neighbours swapping</span></div></section><section className="how"><p className="eyebrow">How it works</p><h2>Easy on your wardrobe.<br />Lighter on the planet.</h2><div className="steps"><article><span>01</span><Package /><h3>List a piece</h3><p>Give a garment its details, condition, and a points value.</p></article><article><span>02</span><Heart /><h3>Find your next love</h3><p>Browse thoughtful finds shared by your local community.</p></article><article><span>03</span><Leaf /><h3>Keep the cycle going</h3><p>Confirm your swap and earn points for your next piece.</p></article></div></section></> }
function Browse() { const [params, setParams] = useSearchParams(); const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const q = params.toString(); useEffect(() => { setLoading(true); call('/items?' + q).then(setItems).finally(() => setLoading(false)) }, [q]); const set = (key, value) => { value ? params.set(key, value) : params.delete(key); setParams(params) }; return <section className="page"><div className="page-title"><div><p className="eyebrow">Community wardrobe</p><h1>Find your next favourite.</h1></div><Link className="btn" to="/list"><Plus /> List an item</Link></div><div className="filters"><label className="search"><Search /><input placeholder="Search garments" defaultValue={params.get('q') || ''} onChange={e => set('q', e.target.value)} /></label><select value={params.get('category') || ''} onChange={e => set('category', e.target.value)}><option value="">All categories</option>{['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Knitwear', 'Accessories'].map(x => <option key={x}>{x}</option>)}</select><select value={params.get('size') || ''} onChange={e => set('size', e.target.value)}><option value="">All sizes</option>{['S', 'M', 'L', 'XL', 'One size'].map(x => <option key={x}>{x}</option>)}</select><select value={params.get('mode') || ''} onChange={e => set('mode', e.target.value)}><option value="">Trade, donate, or rent</option>{['TRADE', 'DONATE', 'RENT'].map(x => <option key={x} value={x}>{x[0] + x.slice(1).toLowerCase()}</option>)}</select></div>{loading ? <p>Finding pieces...</p> : <div className="grid">{items.map(item => <ItemCard key={item.id} item={item} />)}</div>}{!loading && !items.length && <div className="empty">No pieces match those filters. Try another search.</div>}</section> }
function ItemCard({ item }) { return <Link to={`/items/${item.id}`} className="card"><div className="card-img"><img src={img(item)} /><span>{item.mode.toLowerCase()}</span></div><div className="card-copy"><p>{item.category} · {item.size}</p><h3>{item.title}</h3><b>{item.pointsValue} points</b><small>by {item.owner.name} {item.owner.verified && '✓'}</small></div></Link> }
function Auth({ signup, onAuth }) { const nav = useNavigate(), [form, setForm] = useState({ name: '', email: '', password: '' }), [error, setError] = useState(''); const submit = async e => { e.preventDefault(); try { const s = await call('/auth/' + (signup ? 'signup' : 'login'), { method: 'POST', body: JSON.stringify(form) }); onAuth(s); nav('/browse') } catch (e) { setError(e.message) } }; return <section className="auth"><div><Leaf /><p className="eyebrow">Welcome to ReWear</p><h1>{signup ? 'Join the circular closet.' : 'Welcome back.'}</h1><p>{signup ? 'Start with 50 points and give your closet a more meaningful life.' : 'Log in to manage your wardrobe and swaps.'}</p></div><form onSubmit={submit}>{signup && <input placeholder="Your name" required onChange={e => setForm({ ...form, name: e.target.value })} />}<input type="email" placeholder="Email address" required onChange={e => setForm({ ...form, email: e.target.value })} /><input type="password" placeholder="Password" minLength="6" required onChange={e => setForm({ ...form, password: e.target.value })} />{error && <p className="error">{error}</p>}<button className="btn">{signup ? 'Create account' : 'Log in'} <ArrowRight /></button><p>{signup ? 'Already a member? ' : 'New to ReWear? '}<Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></p></form></section> }
function ItemDetail({ session }) { const { id } = useParams(), nav = useNavigate(), [item, setItem] = useState(), [selectedImg, setSelectedImg] = useState(0), [note, setNote] = useState(''), [unlisting, setUnlisting] = useState(false); useEffect(() => { call('/items/' + id).then(setItem) }, [id]); const request = async () => { try { await call('/transactions/request/' + id, { method: 'POST', token: session?.token }); setNote('Request sent! The owner will be notified.') } catch (e) { setNote(e.message) } }; const unlistItem = async () => { if (!window.confirm('Are you sure you want to unlist this item?')) return; setUnlisting(true); try { await call('/items/' + id, { method: 'DELETE', token: session?.token }); nav('/dashboard') } catch (e) { setNote(e.message); setUnlisting(false) } }; if (!item) return <section className="page">Loading piece...</section>; return <section className="detail page"><div><img src={img(item, selectedImg)} style={{ width: '100%', height: '550px', objectFit: 'cover', borderRadius: '4px' }} />{item.images?.length > 1 && <div className="gallery-thumbs">{item.images.map((_, idx) => <img key={idx} src={img(item, idx)} className={selectedImg === idx ? 'active' : ''} onClick={() => setSelectedImg(idx)} />)}</div>}</div><div><p className="eyebrow">{item.mode.toLowerCase()} · {item.category}</p><h1>{item.title}</h1><p className="price">{item.pointsValue} points</p><p>{item.description}</p><div className="chips"><span>Size {item.size}</span><span>{item.condition}</span></div><Link to={`/profile/${item.owner.id}`} className="owner"><div>{item.owner.name[0]}</div><p>Listed by <b>{item.owner.name}</b><small>{item.owner.verified ? '✓ Verified member' : 'Community member'} · ★ {item.owner.rating.toFixed(1)}</small></p></Link>{session?.user.id === item.owner.id ? (<button onClick={unlistItem} disabled={unlisting} className="btn danger"><Trash2 size={18} /> {unlisting ? 'Unlisting...' : 'Unlist item'}</button>) : (session ? <button onClick={request} className="btn">Request this item <ArrowRight /></button> : <Link className="btn" to="/login">Log in to request <ArrowRight /></Link>)}{note && <p className="notice">{note}</p>}</div></section> }
function ListItem({ session }) { const nav = useNavigate(), [form, setForm] = useState({ title: '', description: '', category: 'Tops', size: 'M', condition: 'Good', mode: 'TRADE', pointsValue: 20 }), [files, setFiles] = useState([]), [error, setError] = useState(''); const submit = async e => { e.preventDefault(); const data = new FormData(); Object.entries(form).forEach(([k, v]) => data.append(k, v));[...files].forEach(f => data.append('images', f)); try { const item = await call('/items', { method: 'POST', token: session.token, body: data }); nav('/items/' + item.id) } catch (e) { setError(e.message) } }; return <section className="form-page"><p className="eyebrow">Share a piece</p><h1>Ready for its next story.</h1><form onSubmit={submit} className="listing-form"><label>Title<input required onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Linen summer dress" /></label><label>Description<textarea required rows="4" onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tell the community about the piece, fit, and anything to know." /></label><div className="two"><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Knitwear', 'Accessories'].map(x => <option key={x}>{x}</option>)}</select></label><label>Size<select value={form.size} onChange={e => setForm({ ...form, size: e.target.value })}>{['XS', 'S', 'M', 'L', 'XL', 'One size'].map(x => <option key={x}>{x}</option>)}</select></label></div><div className="two"><label>Condition<select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>{['Like new', 'Excellent', 'Good', 'Well loved'].map(x => <option key={x}>{x}</option>)}</select></label><label>How should it circulate?<select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}>{['TRADE', 'DONATE', 'RENT'].map(x => <option key={x}>{x}</option>)}</select></label></div><label>Points value<input type="number" min="0" value={form.pointsValue} onChange={e => setForm({ ...form, pointsValue: e.target.value })} /></label><label className="upload">Add photos (up to 5)<input type="file" accept="image/*" multiple onChange={e => setFiles(e.target.files)} /><small>{files.length ? `${files.length} photo(s) selected` : 'JPG, PNG, or WebP · 5 MB each'}</small></label>{error && <p className="error">{error}</p>}<button className="btn">Publish listing <ArrowRight /></button></form></section> }
function VerifyEmailModal({ session, onClose, onVerified }) {
  const [demoEmail, setDemoEmail] = useState(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const requestDemoCode = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await call('/auth/send-verification', { method: 'POST', token: session.token });
      setDemoEmail(res.preview);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    requestDemoCode();
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code || code.length < 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const updatedUser = await call('/auth/verify-code', {
        method: 'POST',
        token: session.token,
        body: JSON.stringify({ code: code.trim() })
      });
      setSuccess(true);
      setTimeout(() => {
        onVerified(updatedUser);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillCode = () => {
    if (demoEmail?.code) {
      setCode(demoEmail.code);
      setError('');
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        {success ? (
          <div className="verify-success-view">
            <div className="success-badge-icon"><ShieldCheck /></div>
            <h2>Email Verified!</h2>
            <p>Your account is now fully verified. You've earned trusted member status in the ReWear community!</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <ShieldCheck className="modal-title-icon" />
              <div>
                <h2>Verify Your Email</h2>
                <p className="modal-subtitle">Demo Email Verification System</p>
              </div>
            </div>

            {demoEmail ? (
              <div className="demo-inbox-card">
                <div className="inbox-header">
                  <div className="inbox-tag">📬 Simulated Demo Inbox</div>
                  <small>{new Date(demoEmail.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
                <div className="inbox-details">
                  <p><strong>From:</strong> security@rewear.org</p>
                  <p><strong>To:</strong> {demoEmail.to}</p>
                  <p><strong>Subject:</strong> {demoEmail.subject}</p>
                </div>
                <div className="inbox-body">
                  <p>Hi <strong>{demoEmail.name}</strong>,</p>
                  <p>Your ReWear security verification code is:</p>
                  <div className="code-display">
                    <span>{demoEmail.code}</span>
                    <button type="button" className="autofill-btn" onClick={autofillCode}>
                      ⚡ Auto-fill Code
                    </button>
                  </div>
                  <small>Code valid for 10 minutes. (Demo Simulation)</small>
                </div>
              </div>
            ) : (
              <div className="demo-inbox-loading">
                {loading ? 'Sending verification email...' : 'Preparing demo verification...'}
              </div>
            )}

            <form onSubmit={handleVerify} className="verify-form">
              <label>
                <span>Enter 6-Digit Code</span>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="e.g. 123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="code-input"
                  autoFocus
                />
              </label>

              {error && <p className="error">{error}</p>}

              <div className="verify-form-actions">
                <button type="submit" className="btn" disabled={loading || !code}>
                  {loading ? 'Verifying...' : 'Verify Code'} <ArrowRight />
                </button>
                <button type="button" className="text-link-btn" onClick={requestDemoCode} disabled={loading}>
                  Resend Email Code
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard({ session, update }) {
  const [data, setData] = useState();
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [trackingTx, setTrackingTx] = useState(null);
  const load = () => call('/dashboard', { token: session.token }).then(d => { setData(d); update({ ...session, user: d.user }) });
  useEffect(() => { load() }, []);
  const action = async (id, a) => { try { await call(`/transactions/${id}/${a}`, { method: 'POST', token: session.token }); load() } catch (e) { alert(e.message) } };
  const unlistItem = async (id) => { if (!window.confirm('Are you sure you want to unlist this item?')) return; try { await call('/items/' + id, { method: 'DELETE', token: session.token }); load() } catch (e) { alert(e.message) } };
  if (!data) return <section className="page">Loading your wardrobe...</section>;
  return (
    <section className="page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Your circular wardrobe</p>
          <h1>Hello, {data.user.name.split(' ')[0]}.</h1>
        </div>
        <Link className="btn" to="/list"><Plus /> List an item</Link>
      </div>

      <div className="balance">
        <div>
          <Leaf />
          <p><small>Available points</small><b>{data.user.pointsBalance}</b></p>
        </div>
        <div>
          <ShieldCheck />
          <p>
            <small>Trust status</small>
            <b>{data.user.verified ? 'Verified Member' : 'Unverified'}</b>
          </p>
        </div>
        <div>
          <Star />
          <p><small>Community rating</small><b>{data.user.rating.toFixed(1)} / 5</b></p>
        </div>
      </div>

      {!data.user.verified && (
        <div className="verify-banner">
          <div>
            <h3>Verify your email address</h3>
            <p>Get a verified member badge, increase community trust, and unlock seamless swapping.</p>
          </div>
          <button className="verify" onClick={() => setShowVerifyModal(true)}>
            Verify Email (Demo)
          </button>
        </div>
      )}

      {showVerifyModal && (
        <VerifyEmailModal
          session={session}
          onClose={() => setShowVerifyModal(false)}
          onVerified={(updatedUser) => {
            update({ ...session, user: updatedUser });
            load();
          }}
        />
      )}

      {data.manualReview && <p className="error">Your account has 3 or more open reports and is queued for manual review.</p>}
      <h2>My listings</h2>
      <div className="grid compact">{data.items.length ? data.items.map(i => <div key={i.id} className="item-manage-card"><ItemCard item={{ ...i, owner: data.user }} /><button onClick={() => unlistItem(i.id)} className="btn danger"><Trash2 size={14} /> Unlist item</button></div>) : <p>No listings yet.</p>}</div>

      <h2>Swap activity & Delivery Tracking</h2>
      <div className="transactions">
        {data.transactions.length ? data.transactions.map(t => (
          <div key={t.id}>
            <img src={img(t.item)} />
            <p>
              <b>{t.item.title}</b>
              <small>{t.fromUserId === session.user.id ? `Requested from ${t.toUser.name}` : `Requested by ${t.fromUser.name}`}</small>
            </p>
            <span className={'status ' + t.status.toLowerCase()}>{t.status.toLowerCase().replace('_', ' ')}</span>

            {t.status !== 'PENDING' && t.status !== 'DECLINED' && (
              <button onClick={() => setTrackingTx(t)} className="btn small link-btn">
                <Truck size={14} /> Track Order
              </button>
            )}

            {t.toUserId === session.user.id && t.status === 'PENDING' && (
              <>
                <button onClick={() => action(t.id, 'accept')}>Accept</button>
                <button onClick={() => action(t.id, 'decline')}>Decline</button>
              </>
            )}

            {t.fromUserId === session.user.id && ['CONFIRMED', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(t.status) && (
              <button onClick={() => action(t.id, 'confirm')}>Confirm arrival</button>
            )}
          </div>
        )) : <p>No swaps yet. Find something wonderful in Browse.</p>}
      </div>

      {trackingTx && (
        <DeliveryTrackerModal
          transaction={trackingTx}
          session={session}
          onClose={() => setTrackingTx(null)}
          onRefresh={() => {
            setTrackingTx(null);
            load();
          }}
        />
      )}
    </section>
  );
}
function AdminPanel({ session }) {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const fetchStats = () => call('/admin/stats', { token: session.token }).then(setStats);
  const fetchUsers = () => call('/admin/users', { token: session.token }).then(setUsers);
  const fetchItems = () => call('/admin/items', { token: session.token }).then(setItems);
  const fetchTransactions = () => call('/admin/transactions', { token: session.token }).then(setTransactions);
  const fetchReports = () => call('/admin/reports', { token: session.token }).then(setReports);

  const refreshAll = () => {
    setLoading(true);
    Promise.all([fetchStats(), fetchUsers(), fetchItems(), fetchTransactions(), fetchReports()])
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refreshAll(); }, []);

  const handleUpdateUser = async (userId, data) => {
    try {
      await call(`/admin/users/${userId}`, { method: 'PATCH', token: session.token, body: JSON.stringify(data) });
      fetchUsers();
      fetchStats();
      if (editingUser?.id === userId) setEditingUser(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"?`)) return;
    try {
      await call(`/admin/users/${userId}`, { method: 'DELETE', token: session.token });
      fetchUsers();
      fetchStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (itemId, title) => {
    if (!window.confirm(`Are you sure you want to delete listing "${title}"?`)) return;
    try {
      await call(`/admin/items/${itemId}`, { method: 'DELETE', token: session.token });
      fetchItems();
      fetchStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleResolveReport = async (reportId, status) => {
    try {
      await call(`/admin/reports/${reportId}`, { method: 'PATCH', token: session.token, body: JSON.stringify({ status }) });
      fetchReports();
      fetchStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [users, search]);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.owner.name.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <section className="page admin-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Control Center</p>
          <h1>Admin & Database Management</h1>
        </div>
        <button onClick={refreshAll} className="btn small">
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      <div className="admin-tabs">
        <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
          <Activity size={16} /> Overview Stats
        </button>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          <Users size={16} /> User Management ({users.length})
        </button>
        <button className={tab === 'items' ? 'active' : ''} onClick={() => setTab('items')}>
          <Database size={16} /> Database Items ({items.length})
        </button>
        <button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>
          <Coins size={16} /> Swap Activity ({transactions.length})
        </button>
        <button className={tab === 'reports' ? 'active' : ''} onClick={() => setTab('reports')}>
          <AlertTriangle size={16} /> Reports ({reports.filter(r => r.status === 'OPEN').length} Open)
        </button>
      </div>

      {loading ? (
        <p>Loading Admin Control Center...</p>
      ) : (
        <>
          {tab === 'stats' && stats && (
            <div className="admin-tab-content">
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <div className="icon-wrapper"><Users /></div>
                  <div>
                    <small>Total Registered Users</small>
                    <b>{stats.totalUsers}</b>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="icon-wrapper"><Database /></div>
                  <div>
                    <small>Total Garment Items</small>
                    <b>{stats.totalItems}</b>
                    <span>({stats.activeItems} available)</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="icon-wrapper"><Coins /></div>
                  <div>
                    <small>Completed Swap Deals</small>
                    <b>{stats.completedSwaps}</b>
                    <span>(out of {stats.totalTransactions} requested)</span>
                  </div>
                </div>
                <div className="admin-stat-card">
                  <div className="icon-wrapper"><Coins /></div>
                  <div>
                    <small>Total Points in Economy</small>
                    <b>{stats.totalPoints} pts</b>
                  </div>
                </div>
                <div className="admin-stat-card highlight">
                  <div className="icon-wrapper"><AlertTriangle /></div>
                  <div>
                    <small>Open Moderation Reports</small>
                    <b>{stats.openReports}</b>
                  </div>
                </div>
              </div>

              <div className="admin-quick-summary">
                <h3>System & Database Status</h3>
                <p>✅ <b>Database:</b> Connected to SQLite <code>dev.db</code> via Prisma Client.</p>
                <p>✅ <b>API Server:</b> Express listening on port 4000.</p>
                <p>✅ <b>Admin Auth:</b> Active role-based protection enabled.</p>
              </div>
            </div>
          )}

          {tab === 'users' && (
            <div className="admin-tab-content">
              <div className="admin-toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    placeholder="Search users by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Points Balance</th>
                      <th>Items Listed</th>
                      <th>Swaps Activity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td>
                          <b>{u.name}</b>
                          <small>{u.email}</small>
                        </td>
                        <td>
                          <span className={`badge ${u.isAdmin ? 'admin' : 'user'}`}>
                            {u.isAdmin ? '👑 Admin' : 'User'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.verified ? 'verified' : 'unverified'}`}>
                            {u.verified ? '✓ Verified' : 'Unverified'}
                          </span>
                        </td>
                        <td><b>{u.pointsBalance} pts</b></td>
                        <td>{u._count.items}</td>
                        <td>{u._count.sentTransactions + u._count.receivedTransactions}</td>
                        <td className="actions-cell">
                          <button
                            className="btn small link-btn"
                            onClick={() => setEditingUser(u)}
                          >
                            <Edit3 size={14} /> Edit
                          </button>
                          <button
                            className="btn small danger"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={u.id === session.user.id}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'items' && (
            <div className="admin-tab-content">
              <div className="admin-toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    placeholder="Search items by title, category, or owner..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Garment Item</th>
                      <th>Category & Size</th>
                      <th>Mode</th>
                      <th>Points</th>
                      <th>Owner</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(i => (
                      <tr key={i.id}>
                        <td className="item-cell">
                          <img src={img(i)} alt={i.title} />
                          <div>
                            <b>{i.title}</b>
                            <small>{i.condition}</small>
                          </div>
                        </td>
                        <td>{i.category} · {i.size}</td>
                        <td><span className="badge mode">{i.mode}</span></td>
                        <td><b>{i.pointsValue} pts</b></td>
                        <td>{i.owner.name}</td>
                        <td><span className={`status ${i.status.toLowerCase()}`}>{i.status}</span></td>
                        <td>
                          <button
                            className="btn small danger"
                            onClick={() => handleDeleteItem(i.id, i.title)}
                          >
                            <Trash2 size={14} /> Force Unlist
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'transactions' && (
            <div className="admin-tab-content">
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Garment Item</th>
                      <th>From (Requester)</th>
                      <th>To (Owner)</th>
                      <th>Points</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id}>
                        <td><small>{new Date(t.createdAt).toLocaleDateString()}</small></td>
                        <td className="item-cell">
                          <img src={img(t.item)} alt={t.item.title} />
                          <b>{t.item.title}</b>
                        </td>
                        <td>{t.fromUser.name} <small>({t.fromUser.email})</small></td>
                        <td>{t.toUser.name} <small>({t.toUser.email})</small></td>
                        <td><b>{t.pointsSpent} pts</b></td>
                        <td><span className={`status ${t.status.toLowerCase()}`}>{t.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div className="admin-tab-content">
              {reports.length === 0 ? (
                <p className="empty">No moderation reports logged.</p>
              ) : (
                <div className="table-responsive">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reporter</th>
                        <th>Reported Target</th>
                        <th>Reason</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map(r => (
                        <tr key={r.id}>
                          <td><small>{new Date(r.createdAt).toLocaleDateString()}</small></td>
                          <td>{r.reporter.name}</td>
                          <td>
                            {r.reportedUser && <div>User: <b>{r.reportedUser.name}</b></div>}
                            {r.reportedItem && <div>Item: <b>{r.reportedItem.title}</b></div>}
                          </td>
                          <td><i>"{r.reason}"</i></td>
                          <td><span className={`badge ${r.status.toLowerCase()}`}>{r.status}</span></td>
                          <td>
                            {r.status === 'OPEN' ? (
                              <button
                                className="btn small"
                                onClick={() => handleResolveReport(r.id, 'REVIEWED')}
                              >
                                <CheckCircle size={14} /> Mark Reviewed
                              </button>
                            ) : (
                              <button
                                className="btn small link-btn"
                                onClick={() => handleResolveReport(r.id, 'OPEN')}
                              >
                                Reopen
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setEditingUser(null)}><X size={18} /></button>
            <div className="modal-header">
              <Edit3 className="modal-title-icon" />
              <h2>Edit User: {editingUser.name}</h2>
            </div>
            <form onSubmit={e => {
              e.preventDefault();
              handleUpdateUser(editingUser.id, {
                pointsBalance: editingUser.pointsBalance,
                verified: editingUser.verified,
                isAdmin: editingUser.isAdmin,
                name: editingUser.name,
                email: editingUser.email
              });
            }}>
              <label>
                Full Name
                <input
                  value={editingUser.name}
                  onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                />
              </label>
              <label>
                Email Address
                <input
                  value={editingUser.email}
                  onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                />
              </label>
              <label>
                Points Balance
                <input
                  type="number"
                  value={editingUser.pointsBalance}
                  onChange={e => setEditingUser({ ...editingUser, pointsBalance: e.target.value })}
                />
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={editingUser.verified}
                  onChange={e => setEditingUser({ ...editingUser, verified: e.target.checked })}
                />
                Verified User Badge
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  checked={editingUser.isAdmin}
                  onChange={e => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                />
                Admin Role Privileges
              </label>
              <button className="btn" style={{ marginTop: '16px' }}>Save User Changes</button>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function Profile() { const { id } = useParams(), [data, setData] = useState(); useEffect(() => { call('/profiles/' + id).then(setData) }, [id]); if (!data) return <section className="page">Loading profile...</section>; return <section className="page profile"><div className="avatar">{data.name[0]}</div><p className="eyebrow">Community member</p><h1>{data.name} {data.verified && <span className="verified">✓ Verified</span>}</h1><p>★ {data.rating.toFixed(1)} rating · Sharing since {new Date(data.createdAt).getFullYear()}</p><h2>Available from {data.name.split(' ')[0]}</h2><div className="grid">{data.items.map(i => <ItemCard item={{ ...i, owner: data }} key={i.id} />)}</div></section> }
createRoot(document.getElementById('root')).render(<BrowserRouter><App /></BrowserRouter>);

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Check, ChevronLeft, ChevronRight, Eye, EyeOff, Heart, Leaf, LogOut, MapPin, Phone, RefreshCw } from 'lucide-react';
import { api, favoriteIds } from './api';

const Context = createContext(null);
const useApp = () => useContext(Context);
const iconProps = { size: 18, 'aria-hidden': true };

function useLoad(path, version, enabled = true) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ loading: true });
    api(path, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setState({ ...result, loading: false, path });
    }).catch((error) => {
      if (!controller.signal.aborted) setState({ loading: false, error: error.message, path });
    });
    return () => controller.abort();
  }, [path, version, enabled]);
  return state.path && state.path !== path ? { loading: true } : state;
}

function StayIllustration({ variant = 0 }) {
  return <svg className={`stay-illustration variant-${variant % 3}`} viewBox="0 0 400 200" aria-hidden="true">
    <circle className="sun" cx="315" cy="46" r="23" />
    <path className="land" d="M0 171Q80 139 160 165T400 149V200H0Z" />
    <path className="building-back" d="M111 78H226V178H111Z" />
    <path className="building" d="M167 39H287V178H167Z" />
    <path className="roof" d="M158 39H296V48H158Z" />
    {[65, 96, 127].map((y) => [184, 220, 256].map((x) => <rect className="window" key={`${x}-${y}`} x={x} y={y} width="14" height="19" rx="1" />))}
    {[97, 126].map((y) => [125, 148].map((x) => <rect className="window-back" key={`${x}-${y}`} x={x} y={y} width="10" height="16" />))}
    <path className="door" d="M215 151H241V178H215Z" />
    <path className="tree-trunk" d="M78 177V113M322 179V126" />
    <ellipse className="tree" cx="78" cy="109" rx="23" ry="35" />
    <ellipse className="tree" cx="322" cy="124" rx="19" ry="28" />
    <path className="ground-line" d="M45 179H349" />
  </svg>;
}

function HotelCard({ hotel, rank, index = 0 }) {
  const { ids, favoritesReady, user, pending, toggleFavorite } = useApp();
  const saved = ids.has(hotel._id);
  const price = hotel.displayPrice;
  return <article className="hotel-card">
    <div className="card-art">
      <StayIllustration variant={index} />
      {rank && <span className="rank">0{rank} <span>ที่พักยอดนิยม</span></span>}
      <button className={`heart-button ${saved ? 'saved' : ''}`} type="button"
        aria-label={`${saved ? 'นำออกจาก' : 'เพิ่มใน'}รายการโปรด: ${hotel.name}`}
        aria-pressed={saved} disabled={pending.has(hotel._id) || (user && !favoritesReady)}
        onClick={() => toggleFavorite(hotel)}>
        <Heart size={20} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
      </button>
    </div>
    <div className="card-content">
      {rank && <div className="favorite-count"><Heart size={13} aria-hidden="true" /> {hotel.favoriteCount} คนบันทึกที่พักนี้</div>}
      <h3>{hotel.name}</h3>
      <p className="address"><MapPin {...iconProps} /><span>{hotel.address}</span></p>
      <a className="phone" href={`tel:${hotel.tel.replace(/[^+\d]/g, '')}`}><Phone size={14} aria-hidden="true" />{hotel.tel}</a>
      <div className="card-bottom"><div>
        {price?.amount != null ? <><strong className="price">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: price.currency }).format(price.amount)}</strong><span className="per-night"> / คืน</span></>
          : <span className="unpriced">ยังไม่ระบุราคา</span>}
        {price?.rateUpdatedAt && <small className="rate-note">{price.stale ? 'ใช้อัตราที่เก็บไว้ · ' : 'อัตรา ณ '}{new Date(price.rateUpdatedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</small>}
      </div><span className="hotel-label">HOTEL <ArrowUpRight size={14} aria-hidden="true" /></span></div>
    </div>
  </article>;
}

function LoadingCards() {
  return <div aria-busy="true" aria-label="กำลังโหลดโรงแรม" className="hotel-grid">
    {[0, 1, 2].map((n) => <div className="skeleton-card" key={n}><div /><span /><span /></div>)}
  </div>;
}

function Feedback({ error, onRetry }) {
  return <div className="feedback error-panel" role="alert"><p>{error}</p><button className="button secondary" onClick={onRetry}><RefreshCw {...iconProps} />ลองใหม่</button></div>;
}

function HotelList({ favorites = false }) {
  const { currency, version, user, session, refresh, setCurrency } = useApp();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const endpoint = favorites ? '/favorites' : '/hotels';
  const result = useLoad(`${endpoint}?page=${page}&limit=9&currency=${currency}`, version, !favorites || Boolean(user));
  if (favorites && session === 'loading') return <LoadingCards />;
  if (favorites && !user) return <div className="feedback"><Heart size={32} aria-hidden="true" /><h2>เก็บที่พักที่ถูกใจไว้ด้วยกัน</h2><p>เข้าสู่ระบบเพื่อดูและบันทึกโรงแรมสำหรับทริปครั้งต่อไป</p><Link className="button primary" to="/login" state={{ from: '/favorites' }}>เข้าสู่ระบบ <ArrowRight {...iconProps} /></Link></div>;
  if (result.loading) return <LoadingCards />;
  if (result.error) return <><Feedback error={result.error} onRetry={refresh} />{currency !== 'THB' && <button className="text-button" onClick={() => setCurrency('THB')}>แสดงราคา THB แทน</button>}</>;
  return <>
    {!result.data.length ? <div className="feedback"><Leaf size={32} aria-hidden="true" /><h3>{favorites ? 'ยังไม่มีที่พักในรายการโปรด' : 'ยังไม่มีโรงแรมในหน้านี้'}</h3><p>{favorites ? 'กดหัวใจบนโรงแรมที่ชอบ แล้วกลับมาดูได้ที่นี่' : 'ลองกลับมาดูใหม่ภายหลัง'}</p>{favorites && <Link className="button secondary" to="/">ค้นพบโรงแรม <ArrowRight {...iconProps} /></Link>}</div>
      : <div className="hotel-grid">{result.data.map((hotel, i) => <HotelCard hotel={hotel} key={hotel._id} index={i} />)}</div>}
    {result.pagination.pages > 1 && <nav className="pagination" aria-label="หน้าโรงแรม">
      <button className="button secondary" disabled={page <= 1} onClick={() => setParams({ page: page - 1 })}><ChevronLeft {...iconProps} />ก่อนหน้า</button>
      <span>หน้า {page} จาก {result.pagination.pages}</span>
      <button className="button secondary" disabled={page >= result.pagination.pages} onClick={() => setParams({ page: page + 1 })}>ถัดไป<ChevronRight {...iconProps} /></button>
    </nav>}
    {page > 1 && !result.data.length && <button className="text-button" onClick={() => setParams({})}>กลับหน้าแรก</button>}
  </>;
}

function Home() {
  const { currency, version, refresh } = useApp();
  const top = useLoad(`/hotels/top-favorites?currency=${currency}`, version);
  return <>
    <section className="hero" aria-labelledby="hero-title"><div className="hero-copy">
      <p className="eyebrow"><span className="small-dot" />YOUR NEXT LITTLE ESCAPE</p>
      <h1 id="hero-title">ทริปดี ๆ เริ่มที่<br />ที่พัก<span className="hero-serif">ที่ถูกใจ.</span></h1>
      <p className="hero-description">ค้นพบโรงแรมใหม่ ๆ เก็บที่พักที่ชอบไว้<br className="desktop-break" />แล้วค่อยวางแผนการเดินทางในแบบของคุณ</p>
      <a href="#all-hotels" className="button primary">สำรวจที่พัก <ArrowRight {...iconProps} /></a>
      <div className="hero-caption"><span className="caption-line" />พักสักหน่อย แล้วออกเดินทางต่อ</div>
    </div><div className="hero-scene" aria-hidden="true"><div className="scene-label">A PLACE TO SLOW DOWN</div><StayIllustration /><div className="scene-ticket"><Leaf size={22} /><div>พักให้เต็มที่<small>STAY A LITTLE, FEEL A LOT.</small></div><span>01—03<br /><small>NIGHTS</small></span></div></div></section>
    <section className="section" aria-labelledby="top-title"><div className="section-heading"><div><p className="eyebrow">COMMUNITY PICKS</p><h2 id="top-title">3 ที่พักที่ใคร ๆ ก็เลิฟ <Heart size={24} aria-hidden="true" /></h2><p>โรงแรมที่ถูกบันทึกมากที่สุดจากนักเดินทางของเรา</p></div><span className="section-index">01 / MOST LOVED</span></div>
      {top.loading ? <LoadingCards /> : top.error ? <Feedback error={top.error} onRetry={refresh} /> : !top.data.length ? <div className="quiet-empty">ยังไม่มีอันดับ · บันทึกโรงแรมที่คุณชอบเพื่อเริ่มสร้าง Top 3 ไปด้วยกัน</div> : <div className="hotel-grid">{top.data.map((hotel, i) => <HotelCard key={hotel._id} hotel={hotel} rank={i + 1} index={i} />)}</div>}
    </section>
    <section className="section all-section" id="all-hotels" aria-labelledby="all-title"><div className="section-heading"><div><p className="eyebrow">FIND YOUR STAY</p><h2 id="all-title">มีที่พักที่ใช่ รอคุณอยู่</h2><p>เลือกดูโรงแรม แล้วกดหัวใจเก็บไว้ได้เลย</p></div><span className="section-index">02 / EXPLORE</span></div><HotelList /></section>
    <div className="bottom-note"><Leaf size={22} aria-hidden="true" /><p>ยังไม่ต้องรีบตัดสินใจ <strong>เก็บที่พักที่ชอบไว้ก่อนก็ได้</strong></p><Link to="/favorites">ดูรายการโปรด <ArrowRight {...iconProps} /></Link></div>
  </>;
}

function Favorites() {
  const { ids, user, favoritesReady, favoritesError, refresh } = useApp();
  return <section className="section page-section"><div className="section-heading"><div><p className="eyebrow">YOUR PERSONAL COLLECTION</p><h1>ที่พักที่คุณเก็บไว้</h1><p>ไอเดียสำหรับการเดินทางครั้งต่อไป อยู่ตรงนี้แล้ว</p></div>{user && favoritesReady && <span className="count-pill"><Heart {...iconProps} />{ids.size} ที่พัก</span>}</div>
    {favoritesError ? <Feedback error={favoritesError} onRetry={refresh} /> : <HotelList favorites />}
  </section>;
}

function AuthForm({ register = false }) {
  const { setUser, setSession, notify } = useApp();
  const navigate = useNavigate(), location = useLocation();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const result = await api(register ? '/auth/register' : '/auth/login', { method: 'POST', body: JSON.stringify(values) });
      setUser(result.data); setSession('ready'); notify('เข้าสู่ระบบเรียบร้อยแล้ว');
      const from = location.state?.from;
      navigate(from === '/favorites' ? from : '/', { replace: true });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <section className="auth-layout"><div className="auth-story"><p className="eyebrow">A LITTLE SPACE FOR YOUR NEXT TRIP</p><h1>ทุกการเดินทาง<br />มีที่พัก<span>ที่ถูกใจ.</span></h1><p>เก็บโรงแรมที่ชอบ แล้วกลับมาวางแผน<br />ทริปถัดไปได้ทุกเมื่อ</p><StayIllustration /></div><div className="auth-panel">
    <Link className="back-link" to="/"><ChevronLeft {...iconProps} />กลับไปดูโรงแรม</Link>
    <h2>{register ? 'เริ่มเก็บที่พักที่คุณชอบ' : 'ยินดีต้อนรับกลับมา'}</h2><p>{register ? 'สร้างบัญชีเพื่อบันทึกโรงแรมในรายการโปรด' : 'เข้าสู่ระบบ แล้วค้นพบที่พักโปรดของคุณต่อ'}</p>
    {error && <div className="form-error" tabIndex={-1} ref={errorRef} role="alert">{error}</div>}
    <form onSubmit={submit} aria-busy={busy}>
      {register && <><label htmlFor="name">ชื่อ<span> *</span></label><input id="name" name="name" autoComplete="name" maxLength={100} required />
        <label htmlFor="tel">เบอร์โทรศัพท์<span> *</span></label><input id="tel" name="tel" type="tel" autoComplete="tel" pattern="\+?[0-9][0-9\s\-]{7,14}" required aria-describedby="tel-help" /><small id="tel-help">เช่น 0812345678</small></>}
      <label htmlFor="email">อีเมล<span> *</span></label><input id="email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="password">รหัสผ่าน<span> *</span></label><div className="password-field"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} minLength={register ? 6 : undefined} required aria-describedby={register ? 'password-help' : undefined} /><button type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff {...iconProps} /> : <Eye {...iconProps} />}</button></div>
      {register && <small id="password-help">อย่างน้อย 6 ตัวอักษร</small>}
      <button type="submit" className="button primary submit-button" disabled={busy}>{busy ? 'กำลังดำเนินการ…' : register ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}<ArrowRight {...iconProps} /></button>
    </form><p className="auth-switch">{register ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} <Link state={location.state} to={register ? '/login' : '/register'}>{register ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</Link></p>
  </div></section>;
}

export default function App() {
  const [user, setUser] = useState(null), [session, setSession] = useState('loading');
  const [ids, setIds] = useState(new Set()), [favoritesReady, setFavoritesReady] = useState(false), [favoritesError, setFavoritesError] = useState('');
  const [currency, setCurrency] = useState('THB'), [version, setVersion] = useState(0), [sessionVersion, setSessionVersion] = useState(0);
  const [pending, setPending] = useState(new Set()), [notice, setNotice] = useState(''), [actionError, setActionError] = useState('');
  const pendingRef = useRef(new Set()), mainRef = useRef(null);
  const location = useLocation(), navigate = useNavigate();
  const refresh = () => setVersion((v) => v + 1);
  useEffect(() => {
    const controller = new AbortController();
    setSession('loading');
    api('/auth/me', { signal: controller.signal }).then((res) => {
      if (!controller.signal.aborted) { setUser(res.data); setSession('ready'); }
    }).catch((error) => {
      if (!controller.signal.aborted) { setUser(null); setSession(error.status === 401 ? 'ready' : 'error'); }
    });
    return () => controller.abort();
  }, [sessionVersion]);
  useEffect(() => {
    const controller = new AbortController();
    setFavoritesError(''); setFavoritesReady(false); setIds(new Set());
    if (user) favoriteIds(controller.signal).then((result) => {
      if (!controller.signal.aborted) { setIds(result); setFavoritesReady(true); }
    }).catch((error) => {
      if (!controller.signal.aborted) {
        if (error.status === 401) { setUser(null); setActionError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); }
        else setFavoritesError(error.message);
      }
    });
    return () => controller.abort();
  }, [user, version]);
  useEffect(() => { if (!notice) return; const timeout = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timeout); }, [notice]);
  useEffect(() => { mainRef.current?.focus(); window.scrollTo(0, 0); }, [location.pathname]);

  const toggleFavorite = async (hotel) => {
    if (session === 'loading') return;
    if (!user) { navigate('/login', { state: { from: location.pathname } }); return; }
    if (!favoritesReady || pendingRef.current.has(hotel._id)) return;
    pendingRef.current.add(hotel._id); setPending(new Set(pendingRef.current)); setActionError('');
    const saved = ids.has(hotel._id);
    try {
      await api(`/favorites/${hotel._id}`, { method: saved ? 'DELETE' : 'PUT' });
      setIds((current) => { const next = new Set(current); if (saved) next.delete(hotel._id); else next.add(hotel._id); return next; });
      setNotice(`${saved ? 'นำออกจาก' : 'บันทึกใน'}รายการโปรดแล้ว: ${hotel.name}`); refresh();
    } catch (error) {
      if (error.status === 401) setUser(null);
      setActionError(error.status === 401 ? 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' : `${error.message} · กรุณาลองกดหัวใจอีกครั้ง`);
    } finally { pendingRef.current.delete(hotel._id); setPending(new Set(pendingRef.current)); }
  };
  const logout = async () => {
    try { await api('/auth/logout'); setUser(null); setIds(new Set()); setNotice('ออกจากระบบแล้ว'); navigate('/'); }
    catch (error) { setActionError(error.message); }
  };
  return <Context.Provider value={{ user, setUser, session, setSession, ids, favoritesReady, favoritesError, currency, setCurrency, version, refresh, pending, toggleFavorite, notify: setNotice }}>
    <a className="skip-link" href="#main">ข้ามไปเนื้อหาหลัก</a>
    <header className="site-header"><div className="header-inner"><Link className="brand" to="/" aria-label="พัก หน้าแรก"><span className="brand-mark">พ.</span><span>พัก<small>PAK / STAYS</small></span></Link>
      <nav className="main-nav" aria-label="เมนูหลัก"><NavLink to="/" end>ค้นพบที่พัก</NavLink><NavLink to="/favorites"><Heart size={16} aria-hidden="true" />รายการโปรด{user && favoritesReady && <span className="nav-count">{ids.size}</span>}</NavLink></nav>
      <div className="header-actions"><label className="currency-control"><span className="sr-only">สกุลเงิน</span><select aria-label="สกุลเงิน" value={currency} onChange={(e) => setCurrency(e.target.value)}>{['THB', 'USD', 'EUR', 'JPY'].map((code) => <option key={code}>{code}</option>)}</select></label>
        {user ? <><span className="user-name">{user.name}</span><button className="logout" onClick={logout} disabled={pending.size > 0} aria-label="ออกจากระบบ"><LogOut {...iconProps} /></button></> : <Link className="login-link" to="/login">เข้าสู่ระบบ <ArrowUpRight size={16} aria-hidden="true" /></Link>}
      </div></div></header>
    <main id="main" tabIndex={-1} ref={mainRef}>
      {session === 'error' && <div className="global-alert" role="alert">เชื่อมต่อบัญชีไม่ได้ <button onClick={() => setSessionVersion((v) => v + 1)}>ลองใหม่</button></div>}
      {favoritesError && location.pathname !== '/favorites' && <Feedback error={`โหลดรายการโปรดไม่ได้: ${favoritesError}`} onRetry={refresh} />}
      {actionError && <div className="global-alert" role="alert">{actionError}<button onClick={() => setActionError('')}>ปิด</button></div>}
      <Routes><Route path="/" element={<Home />} /><Route path="/favorites" element={<Favorites />} /><Route path="/login" element={<AuthForm key="login" />} /><Route path="/register" element={<AuthForm key="register" register />} /><Route path="*" element={<div className="feedback"><h1>ไม่พบหน้านี้</h1><Link to="/">กลับหน้าแรก</Link></div>} /></Routes>
    </main>
    <footer className="site-footer"><div className="footer-brand">พัก<span>MAKE ROOM FOR A LITTLE ESCAPE.</span></div><p>ที่พักที่ถูกใจ สำหรับทริปในแบบคุณ</p><span className="footer-detail">THAILAND · STAY INSPIRED</span></footer>
    <div className={`toast ${notice ? 'visible' : ''}`} role="status" aria-live="polite" aria-atomic="true">{notice && <><Check size={18} aria-hidden="true" /><span>{notice}</span></>}</div>
  </Context.Provider>;
}

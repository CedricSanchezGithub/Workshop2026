import { Activity, ArrowRight, CalendarDays, CircleHelp, Menu, Plus, Settings2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { navItems } from '../../data/trips';

const icons = { plus: Plus, calendar: CalendarDays, help: CircleHelp };

export function AppShell({ activeNav, onNavigate, onHome, bookedCount, menuOpen, setMenuOpen, children, chat, user, onLogout }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const avatarSrc = user?.avatarSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(user.avatarSvg)}` : '';
  const initials = user?.name?.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'GU';
  const handleLogout = async () => {
    if (!user || loggingOut) return;
    setLoggingOut(true);
    try { await onLogout(); } finally { setLoggingOut(false); }
  };
  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    const closeOnOutsideClick = (event) => { if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setProfileMenuOpen(false); };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', closeOnOutsideClick); document.removeEventListener('keydown', closeOnEscape); };
  }, [profileMenuOpen]);
  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
      <div className="brand-block"><button className="brand-home" onClick={onHome} aria-label="Retour à l'accueil"><div className="brand-mark"><img src="/logoipsum-434.svg" alt="" /></div><span className="brand-name">Pay<span>&</span>Go</span></button><button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X size={18} /></button></div>
      <div className="sidebar-label">NAVIGATION</div>
      <nav className="main-nav" aria-label="Navigation principale">{navItems.map(({ label, icon }) => { const Icon = icons[icon]; return <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => { onNavigate(label); setMenuOpen(false); }}><Icon size={17} /><span>{label}</span>{label === 'Mes réservations' && bookedCount > 0 && <b className="nav-count">{bookedCount}</b>}{activeNav === label && <ArrowRight className="nav-arrow" size={15} />}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="account-mini"><div className="avatar">{avatarSrc ? <img className="avatar-image" src={avatarSrc} alt="" /> : initials}</div><div><strong>{user?.name || 'Visiteur'}</strong><small>{user?.email || 'Mode invité'}</small></div></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button><div className="breadcrumbs"><span>Pay&Go</span><span className="breadcrumb-chevron">&gt;</span><strong>{activeNav}</strong></div><div className="topbar-actions"><div className="profile-menu-wrap" ref={profileMenuRef}>{user ? <button type="button" className="top-avatar top-avatar-button" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen} aria-haspopup="menu" aria-label="Ouvrir le menu du compte" title="Menu du compte">{avatarSrc ? <img className="avatar-image" src={avatarSrc} alt="" /> : initials}</button> : <div className="top-avatar" aria-label="Compte invité">{initials}</div>}{profileMenuOpen && user && <div className="profile-menu" role="menu"><div className="profile-menu-heading"><strong>{user.name}</strong><small>{user.email}</small></div>{user.role === 'admin' && <button type="button" role="menuitem" onClick={() => { onNavigate('Administration'); setProfileMenuOpen(false); }}><Activity size={14} /> Administration</button>}<button type="button" role="menuitem" onClick={() => { onNavigate('Paramètres'); setProfileMenuOpen(false); }}><Settings2 size={14} /> Paramètres</button><button type="button" role="menuitem" className="profile-logout" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? 'Déconnexion…' : 'Déconnexion'}</button></div>}</div></div></header>{children}</main>{chat}</div>;
}

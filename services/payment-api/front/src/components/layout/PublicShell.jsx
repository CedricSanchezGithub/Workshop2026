import { ArrowRight, Mail, Menu, X } from 'lucide-react';
import { useState } from 'react';

export function PublicShell({ route, onNavigate, children, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const goTo = (nextRoute) => {
    onNavigate(nextRoute);
    setMenuOpen(false);
  };

  return <div className="public-site">
    <header className="public-header">
      <button className="public-brand" onClick={() => goTo('home')} aria-label="Retour à l'accueil">
        <span className="public-brand-mark"><img src="/logoipsum-434.svg" alt="" /></span>
        <span>Pay<span>&</span>Go</span>
      </button>
      <button className="public-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}>
        {menuOpen ? <X size={19} /> : <Menu size={19} />}
      </button>
      <nav className={`public-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navigation du site">
        <button className={route === 'home' ? 'active' : ''} onClick={() => goTo('home')}>Accueil</button>
        <button className={route === 'contact' ? 'active' : ''} onClick={() => goTo('contact')}>Contact</button>
        <button onClick={() => goTo('app')}>Réserver <ArrowRight size={14} /></button>
      </nav>
      <div className="public-actions">
        {user ? <><button className="public-login public-account" onClick={() => goTo('app')}><span className="public-account-avatar">{user.avatarSvg && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(user.avatarSvg)}`} alt="" />}</span>Mon espace</button><button className="public-signup" onClick={onLogout}>Déconnexion</button></> : <><button className="public-login" onClick={() => goTo('login')}>Connexion</button><button className="public-signup" onClick={() => goTo('register')}>Créer un compte</button></>}
      </div>
    </header>
    <main>{children}</main>
    <footer className="public-footer">
      <div><strong>Pay&Go</strong><span>Comparer et réserver vos trajets.</span></div>
      <div className="public-footer-links"><button onClick={() => goTo('contact')}>Nous contacter</button><button onClick={() => goTo(user ? 'app' : 'login')}>{user ? 'Mon espace' : 'Espace client'}</button><span><Mail size={13} /> bonjour@payandgo.fr</span></div>
      <small>© 2026 Pay&Go</small>
    </footer>
  </div>;
}

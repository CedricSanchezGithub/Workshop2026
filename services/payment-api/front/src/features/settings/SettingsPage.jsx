import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';

export function SettingsPage({ user, onLogout }) {
  return <div className="page-wrap narrow-page settings-page">
    <div className="page-heading"><div><span className="section-kicker">COMPTE</span><h1>Paramètres</h1><p>Gérez les informations de votre compte.</p></div></div>
    <div className="settings-grid">
      <section className="settings-card">
        <div className="settings-card-heading"><UserRound size={18} /><div><strong>Profil</strong><span>Informations utilisées pour vos réservations.</span></div></div>
        <dl className="settings-details"><div><dt>Nom</dt><dd>{user?.name || '—'}</dd></div><div><dt>Email</dt><dd>{user?.email || '—'}</dd></div></dl>
      </section>
      <section className="settings-card">
        <div className="settings-card-heading"><ShieldCheck size={18} /><div><strong>Session</strong><span>Votre compte est protégé par une session sécurisée.</span></div></div>
        <div className="settings-status"><Mail size={15} /> Connexion active</div>
        <button type="button" className="settings-logout" onClick={onLogout}><LogOut size={15} /> Déconnexion</button>
      </section>
    </div>
  </div>;
}

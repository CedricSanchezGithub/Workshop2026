import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useState } from 'react';
import { loginUser } from './authClient';

export function LoginPage({ onRegister, onBook, onAuthenticated }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    const form = new FormData(event.currentTarget);
    try { const session = await loginUser({ email: form.get('email'), password: form.get('password') }); onAuthenticated(session); }
    catch (reason) { setError(reason.message === 'INVALID_CREDENTIALS' ? 'Email ou mot de passe incorrect.' : 'Connexion impossible. Vérifiez que l’API est démarrée.'); }
    finally { setLoading(false); }
  };
  return <div className="auth-page"><div className="auth-panel"><div className="auth-heading"><h1>Bon retour.</h1><p>Connectez-vous pour retrouver vos réservations et vos billets.</p></div><form className="auth-form" onSubmit={submit}><label>Email<input name="email" required type="email" placeholder="vous@exemple.fr" /></label><label>Mot de passe<input name="password" required type="password" placeholder="••••••••" /></label>{error && <p className="form-error">{error}</p>}<button className="hero-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'} <ArrowRight size={16} /></button></form><div className="auth-separator"><span>ou</span></div><button className="auth-outline" onClick={onBook}><LockKeyhole size={15} /> Voir les trajets</button><p className="auth-switch">Pas encore de compte ? <button onClick={onRegister}>Créer un compte</button></p></div></div>;
}

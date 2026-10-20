import { ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { registerUser } from './authClient';

export function RegisterPage({ onLogin, onBook, onAuthenticated }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    const form = new FormData(event.currentTarget);
    try { const session = await registerUser({ name: form.get('name'), email: form.get('email'), password: form.get('password') }); onAuthenticated(session); }
    catch (reason) { setError(reason.message === 'EMAIL_ALREADY_REGISTERED' ? 'Cet email est déjà utilisé.' : reason.message === 'AUTH_API_UNAVAILABLE' ? 'Création impossible : l’API est inaccessible. Vérifiez qu’elle est démarrée sur le port 4000.' : reason.message === 'INVALID_AUTH_REQUEST' ? 'Vérifiez le nom, l’email et le mot de passe (8 caractères minimum).' : 'Création impossible. Vérifiez les informations saisies.'); }
    finally { setLoading(false); }
  };
  return <div className="auth-page"><div className="auth-panel register-panel"><div className="auth-heading"><h1>Bienvenue à bord.</h1><p>Créez votre compte pour centraliser vos billets et suivre vos prochains départs.</p></div><form className="auth-form" onSubmit={submit}><label>Nom complet<input name="name" required minLength="2" placeholder="Marie Dupont" /></label><label>Email<input name="email" required type="email" placeholder="vous@exemple.fr" /></label><label>Mot de passe<input name="password" required minLength="8" type="password" placeholder="8 caractères minimum" /></label><label className="check-label terms-check"><input required type="checkbox" /> J'accepte les conditions d'utilisation.</label>{error && <p className="form-error">{error}</p>}<button className="hero-primary auth-submit" type="submit" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'} <ArrowRight size={16} /></button></form><div className="auth-benefits"><span><Check size={13} /> Billets regroupés</span><span><Check size={13} /> Logo personnel généré</span></div><p className="auth-switch">Déjà membre ? <button onClick={onLogin}>Se connecter</button> · <button onClick={onBook}>Voir les trajets</button></p></div></div>;
}

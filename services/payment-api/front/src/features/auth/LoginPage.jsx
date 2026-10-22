import { ArrowRight, LockKeyhole, ScanFace } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { faceCheck, loginUser } from './authClient';

// Flux d'authentification à deux temps (consigne additionnelle 1, WOR-96) :
// identifiant → caméra (reconnaissance faciale) → mot de passe.
export function LoginPage({ onRegister, onBook, onAuthenticated }) {
  const [phase, setPhase] = useState('identify'); // identify | camera | password
  const [email, setEmail] = useState('');
  const [faceToken, setFaceToken] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };
  useEffect(() => stopCamera, []); // coupe la caméra au démontage

  // Retour à la phase identifiant : identifiant remis à vide, caméra éteinte (consigne).
  const resetToIdentify = (message) => {
    stopCamera();
    setFaceToken(null);
    setEmail('');
    setPhase('identify');
    setInfo('');
    setError(message || '');
  };

  // Phase 1 : saisie de l'identifiant → activation de la caméra.
  const submitEmail = async (event) => {
    event.preventDefault();
    setError('');
    const value = String(new FormData(event.currentTarget).get('email') || '').trim();
    if (!value) return;
    setEmail(value);
    setPhase('camera');
    setInfo('Activation de la caméra…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setInfo('Regardez la caméra, puis confirmez votre identité.');
    } catch {
      resetToIdentify('Caméra indisponible. Vérifiez qu’une caméra est branchée sur le PC Hôte.');
    }
  };

  // Capture d'une image et vérification faciale.
  const verifyFace = async () => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setError('');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    try {
      const result = await faceCheck(email, image);
      stopCamera();
      if (result.status === 'recognized') setFaceToken(result.faceToken);
      setInfo('');
      setPhase('password'); // reconnu OU non requis → saisie du mot de passe
    } catch (reason) {
      if (reason.message === 'ACCOUNT_LOCKED') resetToIdentify('Trop de tentatives. Réessayez dans quelques minutes.');
      else if (reason.message === 'FACE_NOT_RECOGNIZED') resetToIdentify('Visage non reconnu. Saisissez à nouveau votre identifiant.');
      else resetToIdentify('Vérification impossible. Réessayez.');
    } finally {
      setLoading(false);
    }
  };

  // Phase 2 : mot de passe (débloquée seulement après l'étape caméra).
  const submitPassword = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const password = String(new FormData(event.currentTarget).get('password') || '');
    try {
      const session = await loginUser({ email, password, faceToken: faceToken || undefined });
      onAuthenticated(session);
    } catch (reason) {
      if (reason.message === 'INVALID_CREDENTIALS') resetToIdentify('Mot de passe incorrect. Reprenez l’identification.');
      else if (reason.message === 'FACE_VERIFICATION_REQUIRED') resetToIdentify('Vérification faciale expirée. Recommencez.');
      else setError('Connexion impossible. Vérifiez que l’API est démarrée.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-heading">
          <h1>Bon retour.</h1>
          <p>Connectez-vous pour retrouver vos réservations et vos billets.</p>
        </div>

        {phase === 'identify' && (
          <form className="auth-form" onSubmit={submitEmail}>
            <label>Email<input name="email" required type="email" defaultValue={email} placeholder="vous@exemple.fr" /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="hero-primary auth-submit" type="submit">Continuer <ArrowRight size={16} /></button>
          </form>
        )}

        {phase === 'camera' && (
          <div className="auth-form">
            <div className="auth-camera">
              <video ref={videoRef} playsInline muted autoPlay />
            </div>
            {info && <p className="form-info">{info}</p>}
            {error && <p className="form-error">{error}</p>}
            <button className="hero-primary auth-submit" type="button" disabled={loading} onClick={verifyFace}>
              {loading ? 'Vérification…' : 'Confirmer mon identité'} <ScanFace size={16} />
            </button>
            <button className="auth-outline" type="button" onClick={() => resetToIdentify('')}>Annuler</button>
          </div>
        )}

        {phase === 'password' && (
          <form className="auth-form" onSubmit={submitPassword}>
            <label>Email<input name="email" type="email" value={email} readOnly /></label>
            <label>Mot de passe<input name="password" required type="password" placeholder="••••••••" autoFocus /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="hero-primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Connexion…' : 'Se connecter'} <ArrowRight size={16} />
            </button>
            <button className="auth-outline" type="button" onClick={() => resetToIdentify('')}>Changer d’identifiant</button>
          </form>
        )}

        <div className="auth-separator"><span>ou</span></div>
        <button className="auth-outline" onClick={onBook}><LockKeyhole size={15} /> Voir les trajets</button>
        <p className="auth-switch">Pas encore de compte ? <button onClick={onRegister}>Créer un compte</button></p>
      </div>
    </div>
  );
}

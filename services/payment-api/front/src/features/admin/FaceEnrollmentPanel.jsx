import { Camera, CameraOff, ImageUp, ScanFace, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { enrollFace, listEnrolledFaces, revokeFace } from './adminClient';

const MAX_SIDE = 1280; // réduit les photos lourdes : le corps est limité à 6 Mo côté API

const errorLabels = {
  ADMIN_REQUIRED: 'Accès administrateur requis.',
  USER_NOT_FOUND: 'Aucun compte ne correspond à cet email.',
  NO_FACE_DETECTED: 'Aucun visage détecté sur l’image. Cadrez le visage de face, bien éclairé.',
  FACE_SERVICE_UNAVAILABLE: 'Service de reconnaissance faciale indisponible.',
  INVALID_ADMIN_REQUEST: 'Email invalide.',
};
const errorMessage = (reason, fallback) => errorLabels[reason.message] || fallback;

// Dessine une source (vidéo ou image) sur un canvas, réduite à MAX_SIDE, et renvoie un Blob JPEG.
function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
}

function fileToJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(toJpeg(image, image.naturalWidth, image.naturalHeight)); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('INVALID_IMAGE')); };
    image.src = url;
  });
}

// Gestion des habilitations faciales (WOR-97) : enrôlement par caméra ou photo, révocation (RGPD).
export function FaceEnrollmentPanel() {
  const [enrolled, setEnrolled] = useState([]);
  const [email, setEmail] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  const refresh = useCallback(async () => {
    try { setEnrolled((await listEnrolledFaces()).enrolled); } catch (reason) { setError(errorMessage(reason, 'Liste des habilitations indisponible.')); }
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  };

  useEffect(() => { refresh(); return stopCamera; }, [refresh]);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      stopCamera();
      setError('Caméra indisponible. Vérifiez qu’une caméra est branchée et que la page est servie en localhost ou https.');
    }
  };

  // La vidéo n'est montée qu'une fois cameraOn passé à vrai : on y rattache le flux à ce moment-là.
  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  const submit = async (image) => {
    const target = email.trim().toLowerCase();
    if (!target) { setError('Saisissez l’email du compte à habiliter.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { samples } = await enrollFace(target, image);
      setNotice(`${target} enrôlé (${samples} échantillon${samples > 1 ? 's' : ''}). Ajoutez d’autres captures pour plus de robustesse.`);
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason, 'L’enrôlement a échoué.'));
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    submit(await toJpeg(video, video.videoWidth, video.videoHeight));
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try { await submit(await fileToJpeg(file)); } catch { setError('Image illisible.'); }
  };

  const revoke = async (user) => {
    if (!window.confirm(`Révoquer l’habilitation faciale de ${user.email} ? Ses gabarits seront supprimés.`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await revokeFace(user.email);
      setNotice(`Habilitation de ${user.email} révoquée.`);
      await refresh();
    } catch (reason) {
      setError(errorMessage(reason, 'La révocation a échoué.'));
    } finally {
      setBusy(false);
    }
  };

  return <section className="admin-panel face-panel">
    <div className="admin-panel-heading"><div><span className="section-kicker">MFA FACIALE</span><h2>Habilitations faciales</h2></div><ScanFace size={20} /></div>
    <p className="admin-panel-copy">Un compte enrôlé doit confirmer son identité à la caméra avant de saisir son mot de passe. Seuls des gabarits (embeddings) sont conservés, jamais les images.</p>
    {error && <div className="admin-alert face-message"><span>{error}</span></div>}
    {notice && <div className="admin-notice face-message"><span>{notice}</span></div>}
    <div className="face-layout">
      <div className="face-enroll">
        <label className="face-field">Email du compte<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vous@exemple.fr" /></label>
        <div className="face-camera">
          {cameraOn ? <video ref={videoRef} playsInline muted autoPlay /> : <span><Camera size={22} />Caméra éteinte</span>}
        </div>
        <div className="face-actions">
          {cameraOn
            ? <><button type="button" className="face-primary" onClick={capture} disabled={busy}><UserPlus size={14} /> {busy ? 'Enrôlement…' : 'Capturer et enrôler'}</button><button type="button" onClick={stopCamera}><CameraOff size={14} /> Couper</button></>
            : <button type="button" className="face-primary" onClick={startCamera} disabled={busy}><Camera size={14} /> Activer la caméra</button>}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}><ImageUp size={14} /> Importer une photo</button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
        </div>
      </div>
      <div className="face-list">
        <div className="scaling-current"><span>Comptes enrôlés</span><strong>{enrolled.length}</strong></div>
        {enrolled.length ? enrolled.map((user) => <div className="face-row" key={user.id}>
          <button type="button" className="face-row-user" onClick={() => setEmail(user.email)} title="Ajouter un échantillon pour ce compte"><strong>{user.name}</strong><small>{user.email}</small></button>
          <button type="button" className="face-revoke" onClick={() => revoke(user)} disabled={busy}><Trash2 size={13} /> Révoquer</button>
        </div>) : <p className="face-empty">Aucun compte enrôlé : la MFA faciale ne s’applique à personne.</p>}
      </div>
    </div>
  </section>;
}

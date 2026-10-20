import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Gauge, Server, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getAdminOverview, scalePaymentWorkers } from './adminClient';

const statusLabels = { operational: 'Opérationnel', degraded: 'Dégradé', down: 'Indisponible' };

export function AdminPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scaling, setScaling] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try { setError(''); setOverview(await getAdminOverview()); } catch (reason) { setError(reason.message === 'ADMIN_REQUIRED' ? 'Accès administrateur requis.' : 'Supervision indisponible. Vérifiez que l’API est démarrée.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer); }, [refresh]);

  const scale = async (workerCount) => {
    setScaling(true); setNotice(''); setError('');
    try { setOverview(await scalePaymentWorkers(workerCount)); setNotice(`Capacité réglée sur ${workerCount} worker${workerCount > 1 ? 's' : ''}.`); } catch (reason) { setError(reason.message === 'ADMIN_REQUIRED' ? 'Accès administrateur requis.' : 'La capacité n’a pas pu être modifiée.'); } finally { setScaling(false); }
  };

  if (loading && !overview) return <div className="page-wrap narrow-page"><div className="admin-loading">Chargement de la supervision…</div></div>;
  if (error && !overview) return <div className="page-wrap narrow-page"><div className="admin-empty"><AlertTriangle size={20} /><h1>Supervision indisponible</h1><p>{error}</p></div></div>;

  const queue = overview.metrics.queue;
  return <div className="page-wrap admin-page">
    <div className="page-heading"><div><span className="section-kicker">ADMINISTRATION</span><h1>Système de paiement</h1><p>État des services et capacité de traitement.</p></div><button type="button" className="admin-refresh" onClick={refresh} disabled={loading}><Activity size={14} /> {loading ? 'Actualisation…' : 'Actualiser'}</button></div>
    {error && <div className="admin-alert"><AlertTriangle size={15} /> {error}</div>}
    {notice && <div className="admin-notice"><CheckCircle2 size={15} /> {notice}</div>}
    <div className="admin-metrics"><div><span>Utilisateurs</span><strong>{overview.metrics.users}</strong></div><div><span>Paiements</span><strong>{overview.metrics.payments}</strong></div><div><span>Queue</span><strong>{queue.depth}</strong><small>en attente</small></div><div><span>Workers</span><strong>{queue.workerCount}</strong><small>{queue.activeWorkers} actif{queue.activeWorkers > 1 ? 's' : ''}</small></div></div>
    <div className="admin-layout">
      <section className="admin-panel"><div className="admin-panel-heading"><div><span className="section-kicker">SERVICES</span><h2>État opérationnel</h2></div><ShieldCheck size={20} /></div><div className="service-list">{overview.services.map((service) => <div className="service-row" key={service.key}><span className={`status-dot ${service.status}`} /><div><strong>{service.name}</strong><small>{service.detail}</small></div><b className={`service-status ${service.status}`}>{statusLabels[service.status]}</b></div>)}</div></section>
      <section className="admin-panel scaling-panel"><div className="admin-panel-heading"><div><span className="section-kicker">CAPACITÉ</span><h2>Workers paiement</h2></div><Gauge size={20} /></div><p className="admin-panel-copy">Ajustez le nombre de workers qui consomment la queue de paiement. Limite de démonstration : 1 à 10.</p><div className="scaling-current"><span>Capacité actuelle</span><strong>{queue.workerCount} worker{queue.workerCount > 1 ? 's' : ''}</strong></div><div className="scaling-controls">{Array.from({ length: overview.scaling.maxWorkers - overview.scaling.minWorkers + 1 }, (_, index) => index + overview.scaling.minWorkers).map((count) => <button type="button" key={count} className={count === queue.workerCount ? 'active' : ''} onClick={() => scale(count)} disabled={scaling}>{count}</button>)}</div><div className="scaling-footnote"><Server size={13} /> API de démonstration · queue mémoire</div></section>
    </div>
    <section className="admin-panel admin-payment-summary"><div className="admin-panel-heading"><div><span className="section-kicker">PAIEMENTS</span><h2>Répartition des états</h2></div><ArrowUpRight size={20} /></div><div className="payment-status-grid">{Object.entries(overview.metrics.paymentStatuses).length ? Object.entries(overview.metrics.paymentStatuses).map(([status, count]) => <div key={status}><strong>{count}</strong><span>{status.replaceAll('_', ' ')}</span></div>) : <p>Aucun paiement traité.</p>}</div></section>
  </div>;
}

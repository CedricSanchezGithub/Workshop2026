import { useEffect, useState } from "react";

// Dashboard de supervision (WOR-40) : l'état du service avant, pendant et après l'incident doit se
// lire en une seconde, y compris filmé pour le Clip Chrono. Données : /api/state du moteur (1 s).

const BANNER = {
  normal: { label: "SERVICE NORMAL", sub: "Paiements opérationnels", cls: "bg-emerald-600" },
  incident: { label: "INCIDENT DÉTECTÉ", sub: "Anomalie confirmée par la détection ML", cls: "bg-red-600 animate-pulse" },
  recovering: { label: "REMÉDIATION EN COURS", sub: "Actions automatiques, sans intervention humaine", cls: "bg-amber-500" },
  restored: { label: "SERVICE RÉTABLI", sub: "Nouvelle transaction de test réussie", cls: "bg-sky-600" },
  degraded: { label: "SERVICE DÉGRADÉ", sub: "La transaction de test échoue", cls: "bg-orange-600" },
  failed: { label: "REMÉDIATION EN ÉCHEC", sub: "Escalade : intervention humaine requise", cls: "bg-red-800" },
};
const TYPE = { dos: "Attaque A — déni de service", sqli: "Attaque B — injection" };
const STEP_ICON = { ok: "✓", failed: "✗", running: "…", skipped: "–" };
const STEP_CLS = { ok: "text-emerald-700", failed: "text-red-700", running: "text-amber-600", skipped: "text-slate-500" };

const hhmmss = (t) => (t ? new Date(t * 1000).toLocaleTimeString("fr-FR") : "—");

export default function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now() / 1000);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (alive) { setState(data); setError(null); }
      } catch (e) {
        if (alive) setError(e.message);
      }
    };
    poll();
    const a = setInterval(poll, 1000);
    const b = setInterval(() => setNow(Date.now() / 1000), 250);
    return () => { alive = false; clearInterval(a); clearInterval(b); };
  }, []);

  if (!state) {
    return <div className="p-10 text-xl">{error ? `Moteur de remédiation injoignable (${error})` : "Chargement…"}</div>;
  }
  const incident = state.incidents[0];
  return (
    <div className="mx-auto max-w-[1400px] p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl md:text-2xl font-bold">RESILIENCE-ALPHA — supervision et reprise autonome</h1>
        <div className="font-mono text-lg">{new Date(now * 1000).toLocaleTimeString("fr-FR")}</div>
      </header>
      {error && <div className="rounded bg-red-100 px-3 py-2 text-red-800">Moteur injoignable : {error} (dernier état affiché)</div>}

      <Banner banner={state.banner} now={now} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Components components={state.components} />
        <Transaction tx={state.last_transaction} availability={state.availability} />
        <Detector detector={state.detector} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><Incident inc={incident} now={now} /></div>
        <Events events={state.events} />
      </div>
    </div>
  );
}

function Card({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/70">{title}</h2>
      {children}
    </section>
  );
}

function Banner({ banner, now }) {
  const b = BANNER[banner.state] ?? BANNER.normal;
  const elapsed = banner.since ? Math.max(0, Math.round(now - banner.since)) : null;
  return (
    <div className={`rounded-2xl px-6 py-5 text-white shadow ${b.cls}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-3xl md:text-5xl font-extrabold tracking-tight">{b.label}</div>
          <div className="mt-1 text-lg opacity-90">
            {banner.type ? `${TYPE[banner.type]} · ` : ""}{b.sub}
          </div>
        </div>
        <div className="text-right font-mono">
          {banner.state === "restored" && <div className="text-2xl font-bold">reprise en {banner.duration_s} s</div>}
          {["incident", "recovering"].includes(banner.state) && elapsed !== null && <div className="text-4xl font-bold">{elapsed} s</div>}
          {banner.incident && <div className="opacity-80">{banner.incident}</div>}
        </div>
      </div>
    </div>
  );
}

function Components({ components }) {
  const entries = Object.entries(components);
  return (
    <Card title="Composants">
      {entries.length === 0 && <div className="text-slate-500">En attente du premier contrôle…</div>}
      <ul className="space-y-2">
        {entries.map(([k, c]) => (
          <li key={k} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className={`inline-block h-3 w-3 rounded-full ${c.ok ? "bg-emerald-500" : "bg-red-500"}`} />
              {c.label}
            </span>
            <span className="text-sm text-slate-500">{c.detail}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Transaction({ tx, availability }) {
  return (
    <Card title="Transaction de test (preuve de service)">
      {tx ? (
        <>
          <div className={`text-2xl font-bold ${tx.ok ? "text-emerald-700" : "text-red-700"}`}>
            {tx.ok ? "Paiement accepté" : `Échec (${tx.stage})`}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            {hhmmss(tx.at)} · {tx.duration_ms} ms {tx.payment_id ? `· ${tx.payment_id.slice(0, 15)}…` : ""}
          </div>
        </>
      ) : <div className="text-slate-500">Aucune transaction encore</div>}
      <div className="mt-4 flex h-6 items-end gap-[2px]" title="Dernières transactions de test (vert = réussie)">
        {availability.slice(-60).map((p, i) => (
          <div key={i} className={`h-full flex-1 rounded-sm ${p.ok ? "bg-emerald-500" : "bg-red-500"}`} />
        ))}
      </div>
      <div className="mt-1 text-xs text-slate-500">Dernières transactions (une toutes les 15 s)</div>
    </Card>
  );
}

function Detector({ detector }) {
  const fams = detector?.families ?? {};
  const history = detector?.history ?? [];
  return (
    <Card title="Détection ML (Isolation Forest par famille)">
      {Object.keys(fams).length === 0 && <div className="text-slate-500">Service de détection injoignable</div>}
      <div className="space-y-3">
        {Object.entries(fams).map(([fam, f]) => (
          <div key={fam}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">{fam === "traffic" ? "Trafic → A (DoS)" : "Injection → B (SQLi)"}</span>
              <span className={f.anomaly ? "font-bold text-red-700" : "text-emerald-700"}>
                {f.active ? "ALERTE" : f.anomaly ? "anormal" : "normal"}
              </span>
            </div>
            <Spark points={history.map((h) => h[fam])} threshold={f.threshold} />
            <div className="text-xs text-slate-500">
              score {f.if_score} (seuil {f.threshold}) · enveloppe ×{f.z_max_ratio} · {f.worst_feature}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Spark({ points, threshold }) {
  // Courbe du score IF (bas = anormal) avec la ligne de seuil ; rouge si fenêtre anormale.
  const valid = points.filter(Boolean);
  if (valid.length < 2) return <div className="h-12" />;
  const vals = valid.map((p) => p.if_score).concat([threshold]);
  const min = Math.min(...vals) - 0.02, max = Math.max(...vals) + 0.02;
  const W = 300, H = 48;
  const x = (i) => (i / (valid.length - 1)) * W;
  const y = (v) => H - ((v - min) / (max - min)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-12 w-full" preserveAspectRatio="none">
      <line x1="0" x2={W} y1={y(threshold)} y2={y(threshold)} stroke="#dc2626" strokeDasharray="4 3" strokeWidth="1" />
      <polyline fill="none" stroke="#261E48" strokeWidth="2" points={valid.map((p, i) => `${x(i)},${y(p.if_score)}`).join(" ")} />
      {valid.map((p, i) => p.anomaly && <circle key={i} cx={x(i)} cy={y(p.if_score)} r="2.5" fill="#dc2626" />)}
    </svg>
  );
}

function Incident({ inc, now }) {
  if (!inc) {
    return <Card title="Dernier incident"><div className="text-slate-500">Aucun incident depuis le démarrage du moteur.</div></Card>;
  }
  return (
    <Card title={`Incident ${inc.id} — ${TYPE[inc.type]}`}>
      <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>Détecté à <b>{hhmmss(inc.detected_at)}</b></span>
        <span>État <b>{inc.state}</b></span>
        <span>Durée <b>{inc.resolved_at ? inc.duration_s : Math.round(now - inc.detected_at)} s</b></span>
        <span>Score <b>{inc.score}</b> (seuil {inc.threshold})</span>
        {inc.blocked.length > 0 && <span>IP bloquées <b className="font-mono">{inc.blocked.join(", ")}</b></span>}
      </div>
      {Object.keys(inc.top_features ?? {}).length > 0 && (
        <div className="mb-3 text-sm text-slate-600">
          Signaux anormaux : {Object.entries(inc.top_features).map(([k, v]) => `${k} = ${v}`).join(" · ")}
        </div>
      )}
      <ol className="space-y-1.5">
        {inc.steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className={`w-5 text-center font-bold ${STEP_CLS[s.status]}`}>{STEP_ICON[s.status]}</span>
            <span className="w-20 shrink-0 font-mono text-sm text-slate-500">{hhmmss(s.started)}</span>
            <span><b>{s.label}</b>{s.detail && <span className="text-slate-600"> — {s.detail}</span>}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const EVENT_LABEL = {
  incident_detected: "Incident détecté", incident_resolved: "Incident résolu", escalation: "Escalade",
  alert_received: "Alerte reçue", alert_rejected: "Alerte refusée", detector_resolved: "Détecteur : retour à la normale",
  probe: "Transaction de test", component: "Composant", engine_started: "Moteur démarré",
};

function Events({ events }) {
  const shown = events.filter((e) => EVENT_LABEL[e.event]).slice(-14).reverse();
  return (
    <Card title="Journal">
      <ul className="space-y-1 text-sm">
        {shown.map((e, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-slate-500">{hhmmss(e.ts)}</span>
            <span>
              {EVENT_LABEL[e.event]}
              {e.type ? ` (${e.type})` : ""}
              {e.event === "probe" ? (e.ok ? " : OK" : ` : échec ${e.stage}`) : ""}
              {e.event === "component" ? ` ${e.component} ${e.ok ? "OK" : "KO"}` : ""}
              {e.event === "incident_resolved" ? ` en ${e.duration_s} s` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

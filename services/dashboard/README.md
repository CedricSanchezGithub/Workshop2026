# services/dashboard — Supervision (WOR-40)

Interface de supervision pour le jury et le Clip Chrono : l'état du service **avant, pendant et après** l'incident se lit en une seconde.

| Zone | Contenu |
|---|---|
| Bandeau | `SERVICE NORMAL` → `INCIDENT DÉTECTÉ` → `REMÉDIATION EN COURS` → `SERVICE RÉTABLI (reprise en N s)` ; `DÉGRADÉ` / `ÉCHEC` sinon |
| Composants | WAF + API (santé), Prometheus, Loki, détection ML, moteur |
| Transaction de test | Dernier paiement de test (preuve de service) + bande des 60 dernières transactions |
| Détection ML | Courbe du score Isolation Forest par famille avec son seuil, fenêtres anormales en rouge |
| Incident | Étapes horodatées (décision, garde-fous, blocage, restauration, vérification), IP bloquées, signaux anormaux |
| Journal | Événements du moteur |

React 18 + Vite + Tailwind (couleurs de la charte EPSI). Données : `GET /api/state` du moteur toutes les secondes.

```bash
npm ci && npx vite build       # dist/ servi par le moteur sur http://127.0.0.1:8090
npm run dev                    # développement : http://127.0.0.1:5173 (/api relayé vers le moteur)
```

`scripts/start-remediation.sh` construit le dashboard s'il est absent.

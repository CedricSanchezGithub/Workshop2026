# services/remediation — Moteur de remédiation (WOR-38, WOR-39, WOR-64)

Reçoit l'alerte du détecteur ML → décide → agit sur la plateforme → **vérifie** que le service est de nouveau utilisable. Sert aussi le dashboard de supervision (`services/dashboard`, WOR-40).

```
ml-inference ──POST /alerts (HMAC)──▶ moteur (PC Hôte, :8090)
                                         ├─ décide (table A ≠ B)
                                         ├─ agit : ansible-playbook playbooks/remediation/*.yml (liste fermée)
                                         ├─ vérifie : transaction de test à travers le WAF
                                         └─ publie : /api/state + dashboard, journaux JSON, /metrics
```

## Démarrer

```bash
scripts/start-remediation.sh start     # arrière-plan ; aussi lancé par ansible deploy.yml
scripts/start-remediation.sh status    # état, dernière transaction de test, composants
scripts/start-remediation.sh stop
```

Dashboard : **http://127.0.0.1:8090**. Prérequis : plateforme déployée (`ansible-playbook playbooks/deploy.yml`, qui génère la clé HMAC), `uv`, `ansible-playbook`.

## Table de décision

| Alerte | Actions | Preuve de reprise |
|---|---|---|
| `dos` (attaque A, disponibilité) | 1. bloquer les IP sources au WAF (`waf-block-ip`) 2. transaction de test ; si elle échoue : redémarrer payment-api (`restart-service`) | transaction de test réussie |
| `sqli` (attaque B, intégrité) | 1. bloquer les IP sources 2. constat d'état 3. recréer payment-api depuis son image (`restore-service`) : l'API est en mémoire, elle repart de son état sain connu | transaction de test réussie après restauration |

- Un incident n'est **résolu** qu'après une transaction complète réussie (connexion → intention de paiement `booking_1` → code de vérification → paiement `succeeded`). Un conteneur redémarré ne suffit pas (sujet §2).
- Après **2 tentatives** infructueuses : incident `failed` + événement `escalation` (procédure `docs/runbooks/reprise.md`).
- Une nouvelle alerte du même type pendant un incident en cours est fusionnée : seules les nouvelles IP sont bloquées.

Mesures sur la plateforme (PC de dev, 2026-10-20) : DoS résolu en **4,6 s** (blocage 4 s + transaction 0,3 s) ; injection résolue en **10,1 s** (blocage, restauration 7,8 s, transaction).

## Sécurité du moteur (sujet §3.4 : « droits élevés sur les conteneurs »)

| Mesure | Détail |
|---|---|
| Pas d'accès brut au socket Docker | Le moteur ne lance que 4 playbooks (`ansible/playbooks/remediation/`), en `argv` sans shell, avec paramètres validés deux fois (moteur + `assert` Ansible) |
| Services modifiables | Liste fermée `remediation_services` : `payment-api` uniquement |
| Entrée authentifiée | `POST /alerts` exige une signature HMAC-SHA256 du corps (clé `infra/secrets/remediation/hmac_key`, hors Git, jamais en variable d'environnement), une alerte de moins de 60 s et un identifiant jamais vu (anti-rejeu) |
| Garde-fous | Jamais de blocage des adresses de l'hôte (passerelles Docker, hotspot `192.168.137.1`), de la loopback, des plages spéciales ; IPv4 uniquement, 20 IP max par alerte |
| Exposition | Écoute sur `127.0.0.1` (dashboard) et la passerelle Docker (alertes de `ml-inference`), **jamais** sur le hotspot (contrôlé par `verify.yml`) |
| Traçabilité | Chaque étape est journalisée en JSON (stdout + `data/events.jsonl`) et visible au dashboard |

Contrat d'alerte : [`docs/architecture/contrat-alerte-remediation.md`](../../docs/architecture/contrat-alerte-remediation.md).

## API

| Route | Rôle |
|---|---|
| `POST /alerts` | Alertes signées du détecteur — seule route qui déclenche une action |
| `GET /api/state` | État pour le dashboard : bandeau (normal / incident / remédiation / rétabli / dégradé / échec), composants, dernière transaction, détecteur, incidents, événements |
| `GET /api/events` | Flux temps réel (Server-Sent Events) |
| `POST /api/probe` | Lance une transaction de test |
| `GET /health`, `GET /metrics` | Santé ; métriques Prometheus (`remediation_incidents_total`, `remediation_duration_seconds`, `remediation_probe_ok`…) |

## Développement

```bash
cd services/remediation
uv sync && uv run pytest        # signature, rejeu, garde-fous, liste fermée, table de décision, escalade
```

| Fichier | Rôle |
|---|---|
| `remediation/app.py` | API FastAPI, bandeau, métriques |
| `remediation/engine.py` | Machine à états des incidents et table de décision |
| `remediation/playbooks.py` | Exécution de la liste fermée de playbooks |
| `remediation/probe.py` | Transaction de test à travers le WAF |
| `remediation/guards.py` | IP jamais bloquées |
| `remediation/signing.py` | HMAC, fraîcheur, anti-rejeu |
| `remediation/monitor.py` | État des composants et transaction périodique (15 s) |

## Limites connues

- **Limite de connexion de l'API** : payment-api autorise 12 connexions/inscriptions par IP et par 15 min. La sonde du moteur doit se réinscrire après chaque restauration (API en mémoire) ; plusieurs répétitions rapprochées peuvent atteindre la limite et faire échouer la vérification. À traiter côté API (compte de supervision dédié ou exception documentée), décision de l'équipe Développement.
- Le moteur tourne sur l'hôte : sur un PC Hôte Windows, le lancer depuis WSL2 (comme Ansible).
- Une IP bloquée le reste jusqu'au `waf-unblock-all` (fin de répétition, `scripts/reset-known-good.sh`).

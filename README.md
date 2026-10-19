# Workshop2026

Lien du drive: https://drive.google.com/drive/folders/1U6b8GWQVU8LXfAwV5N9v2cItiaP0pyOv

## Répartition des domaines

Chaque pilier a un responsable. Les décisions d'architecture restent prises ensemble.

| Domaine | Responsable | Projet Linear |
|---|---|---|
| Développement | Michael | Développement — SI de paiement & remédiation |
| Infrastructure | Reza | Infrastructure & Observabilité |
| IA / Data | Léa | IA / Data — Détection ML & Assistant RAG |
| Cybersécurité | Axel | Cybersécurité — Red Team & Défense |
| Gouvernance / Transformation | Cédric | Gouvernance & Transformation |

## Structure du dépôt

| Dossier | Contenu | Responsable |
|---|---|---|
| `services/` | Microservices du SI de paiement + moteur de remédiation + dashboard | Michael |
| `infra/` | Docker Compose, Prometheus, Grafana, Loki, WAF | Reza |
| `ansible/` | Playbooks (déploiement, relance, remédiation) | Reza |
| `ml/` | Détection d'anomalies (données, features, entraînement, inférence) | Léa |
| `rag/` | Assistant opérateur local (Ollama + LangChain) | Léa |
| `attack/` | Scénarios offensifs A (DoS) et B (injection) | Axel |
| `scripts/` | Utilitaires (reset known-good…) | — |
| `docs/` | Architecture, ADR, gouvernance, spéc d'attaque, checklist | Cédric |

Chaque dossier contient un `README.md` qui détaille son contenu et les tickets Linear associés.
Convention : aucun secret en clair dans le dépôt (cf `.gitignore`).

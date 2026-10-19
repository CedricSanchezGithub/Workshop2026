# ml/ — Détection d'anomalies (machine learning)

Responsable IA / Data : Léa. La détection NE doit PAS se réduire à des seuils en dur (WOR-52).

| Dossier | Rôle | Ticket |
|---|---|---|
| `data/` | Jeu de données figé (trafic normal + attaque A/B, étiqueté) | WOR-50 |
| `features/` | Nettoyage, fenêtrage temporel, normalisation, choix des features | WOR-51 |
| `training/` | Entraînement + évaluation (précision, rappel, faux positifs) | WOR-52 |
| `inference/` | Service lisant métriques/logs en continu → alerte vers remédiation + dashboard | WOR-53 |

Entrées = signaux figés dans `docs/attack-scenarios.md` (WOR-29).

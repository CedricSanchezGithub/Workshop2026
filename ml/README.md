# ml/ — Détection d'anomalies (machine learning)

Responsable IA / Data : Léa. La détection NE doit PAS se réduire à des seuils en dur (WOR-52).

| Dossier | Rôle | Ticket |
|---|---|---|
| `lab/` | Labo de données : API fictive + WAF + Prometheus/Loki/Grafana, trafic normal, étiquetage | WOR-50 |
| `data/` | Jeu de données figé (trafic normal + attaque A/B, étiqueté) | WOR-50 |
| `features/` | Nettoyage, fenêtrage temporel, normalisation, choix des features | WOR-51 |
| `training/` | Entraînement + évaluation (précision, rappel, faux positifs) | WOR-52 |
| `inference/` | Service lisant métriques/logs en continu → alerte vers remédiation + dashboard | WOR-53 |

Entrées = signaux figés dans `docs/attack-scenarios.md` (WOR-29).

## Approche retenue

Une **Isolation Forest par famille de signaux** (`traffic` → attaque A, `injection` → attaque B), entraînée uniquement sur du trafic normal. La famille qui déclenche indique le type d'incident au moteur de remédiation. Fenêtres glissantes de 60 s évaluées toutes les 10 s.

```bash
cd ml && uv sync && uv run pytest
```

Contrat avec la plateforme (noms de métriques, champs de journaux, labels Loki) : [`docs/architecture/contrat-observabilite-ia.md`](../docs/architecture/contrat-observabilite-ia.md).

# Dataset figé (WOR-50) — normal / attaque A / attaque B, étiqueté et horodaté.
# Versionné dans le dépôt pour une détection reproductible à la démo.

| Fichier | Contenu |
|---|---|
| `normal_01.parquet` | 265 fenêtres de 60 s (44 min, pas de 10 s) de trafic légitime sur le labo : 20 clients, 2,8 → 10,8 req/s, 99 % de paiements acceptés |
| `labels.csv` | Fenêtres d'incident (`start`, `end`, `type`, `note`) notées pendant les sessions d'attaque. À venir |

Une ligne = une fenêtre ; une colonne par feature (voir `ml/features/README.md`) + `label` (`normal`, `dos`, `sqli`, `transition`). Les étiquettes servent uniquement à évaluer le détecteur.

`runs/` (non versionné) contient les journaux des enregistrements.

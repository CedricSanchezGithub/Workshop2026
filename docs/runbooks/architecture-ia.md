---
titre: Architecture du pilier IA / Data
statut: brouillon (pilier IA)
---

# Architecture du pilier IA / Data

## Composants

| Composant | Rôle | Accès |
|---|---|---|
| Détecteur d'anomalies | Calcule les features depuis Prometheus et Loki, score avec une Isolation Forest par famille, envoie les alertes | Lecture seule sur Prometheus et Loki ; écriture uniquement vers l'endpoint `/alerts` du moteur de remédiation |
| Assistant opérateur (RAG) | Répond aux questions des opérateurs à partir de la documentation de l'équipe | Lecture seule sur la documentation indexée ; aucun accès au système ni au moteur de remédiation |
| Ollama | Sert le modèle de langage `qwen2.5:7b` et le modèle d'embedding multilingue `bge-m3` | Joignable uniquement par l'assistant |

## Familles de détection

- **Trafic → `dos`** : débit de requêtes, latence p95/p99, part d'erreurs 5xx et 429, octets renvoyés, transactions acceptées, nombre d'IP distinctes, part de l'IP la plus active.
- **Injection → `sqli`** : blocages WAF, règles CRS 942xxx, score d'anomalie CRS, caractères de syntaxe SQL dans les URL, taille moyenne des requêtes, requêtes mal formées, erreurs base.

Chaque famille a sa propre Isolation Forest, entraînée uniquement sur du trafic normal. La famille qui déclenche indique le type d'incident, ce qui permet au moteur de remédiation de choisir la bonne réponse.

## Contrat d'alerte

Le détecteur envoie `POST /alerts` au moteur de remédiation, en JSON signé HMAC-SHA256 (en-tête `X-Signature`). Champs principaux : `type` (`dos` ou `sqli`), `score`, `threshold`, `target`, `offenders` (IP sources), `top_features`, `window_s`. Un événement `resolved` est envoyé quand le service redevient normal.

## Choix du modèle de langage

`qwen2.5:7b` (7 milliards de paramètres, sous la limite de 8 milliards du sujet) : bon niveau en français, tient dans 8 Go de mémoire GPU une fois quantifié. Il tourne sur le PC IA pour ne pas charger le PC Hôte.

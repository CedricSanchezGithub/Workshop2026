# services/ — Microservices du SI de paiement fictif

Responsable Développement : Michael. Stack API : Node.js, Python/FastAPI ou Go (à figer dans un ADR, WOR-26).

| Service | Rôle | Ticket |
|---|---|---|
| `auth/` | Login, émission/validation de jetons, rôles | WOR-34 |
| `payment-api/` | Créer/traiter/consulter une transaction ; healthcheck métier réel | WOR-35 |
| `frontend/` | Front web de paiement (React + Tailwind) | WOR-36 |
| `dashboard/` | Supervision : composants, événements, alertes, reprise (React + Tailwind) | WOR-40 |
| `remediation/` | Moteur de remédiation : reçoit l'alerte → décide → agit → **vérifie** | WOR-38 |

Chaque service expose `/metrics` (Prometheus) et des logs JSON vers stdout (Loki) — WOR-37.

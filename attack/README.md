# attack/ — Scénarios offensifs (Red Team)

Responsable Cybersécurité : Axel.

> ⚠️ Périmètre strict (WOR-66) : attaques limitées AU SEUL SI du groupe et aux machines
> autorisées de l'équipe, sur le réseau RESILIENCE-G6. Jamais les réseaux du campus,
> les autres groupes, un équipement tiers ou Internet. Aucune donnée financière réelle.

| Dossier | Scénario | Ticket |
|---|---|---|
| `scenario-a-dos/` | DoS / épuisement de ressources (PRINCIPAL) | WOR-58 |
| `scenario-b-injection/` | Injection applicative (SECONDAIRE) | WOR-59 |

Exécutés depuis le **PC Attaquant** (distinct du PC Hôte). Scripts paramétrables
(cible, intensité, durée), reproductibles, avec start/stop nets pour le Clip Chrono.
Spéc = `docs/attack-scenarios.md` (WOR-29).

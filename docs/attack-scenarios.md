# Scénarios d'attaque — spécification figée (WOR-29)

> Contrat d'interface entre l'attaque (WOR-58/59), la détection ML (WOR-53) et la remédiation (WOR-38).
> Responsable Cybersécurité : Axel. À figer le lundi — ne plus modifier sans prévenir IA/Data et Infra.

## Attaque A — DoS / épuisement de ressources (PRINCIPALE)
Réponse attendue = **restauration de la disponibilité**.

| Champ | Valeur (à compléter et figer) |
|---|---|
| Vecteur | flood / slow-drain de l'API métier depuis le PC Attaquant |
| Effet observable | latence + taux d'erreur explosent, API indisponible |
| Signaux Prometheus | _ex. `http_request_duration_seconds`, ratio 5xx, débit_ |
| Signaux Loki | _champs de log à préciser_ |
| Décision de remédiation | rate-limit WAF + redémarrage/scale + playbook Ansible |
| Preuve de reprise | nouvelle transaction OK, latence revenue au niveau de base |

## Attaque B — injection applicative (SECONDAIRE)
Réponse attendue = **correction d'une compromission / intégrité** (≠ A).

| Champ | Valeur |
|---|---|
| Vecteur | entrée malformée abusée contre l'API |
| Effet observable | erreurs applicatives, corruption de données de test, tentative de contournement d'auth |
| Signaux | règle WAF déclenchée + motif anormal dans Loki |
| Décision | blocage source WAF + rollback snapshot BDD propre + rotation secret |
| Preuve de reprise | transaction OK **ET** intégrité des données vérifiée |

**Rappel sujet §2** : ne pas confondre restauration de disponibilité (A) et traitement d'une compromission/fuite (B).

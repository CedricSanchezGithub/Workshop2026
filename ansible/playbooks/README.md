# Playbooks (WOR-44)

| Playbook | Rôle | État |
|---|---|---|
| `deploy.yml` | Crée `infra/.env` (config non secrète) si absent, initialise / descelle / configure Vault (`tasks/vault-bootstrap.yml`), lance la stack, attend les healthchecks puis enchaîne sur `verify.yml`. Relancé après un redémarrage, il redescelle Vault. Redémarre tout service dont un fichier de configuration (`config_watch`) a été modifié depuis son démarrage | ✅ |
| `verify.yml` | Vérifie que chaque service **répond** (Vault descellé, Postgres et Grafana acceptent les mots de passe de Vault, Prometheus, Loki, cibles UP, journaux de chaque service présents dans Loki) et qu'aucun secret n'est dans l'environnement des conteneurs. Chaîne de reprise (`tasks/verify-remediation.yml`, tag `remediation`) : règle de blocage chargée dans le WAF, clé HMAC, détection ML, moteur, **transaction de test de bout en bout**, moteur non exposé sur le hotspot | ✅ |
| `vault-user.yml` | Crée un compte Vault à partir d'une adresse e-mail (identifiant = partie avant `@`) avec mot de passe saisi au clavier ; relancé, réinitialise le mot de passe | ✅ |
| `teardown.yml` | Arrête la stack, conserve les données (`-e purge=true` supprime aussi les volumes et les clés Vault locales) | ✅ |
| `restore.yml` | Restauration données / configuration | à faire |
| `remediation/waf-block-ip.yml` | Ajoute des IP (`-e '{"ips": [...]}'`) à la liste de blocage du WAF et recharge nginx en attendant que la nouvelle liste soit active (~4 s). Refuse les adresses invalides, loopback, non spécifiées | ✅ |
| `remediation/waf-unblock-all.yml` | Vide la liste de blocage (fin de répétition, `reset-known-good`) | ✅ |
| `remediation/restart-service.yml` | Redémarre un service de `remediation_services` (`payment-api`) et attend son healthcheck — attaque A | ✅ |
| `remediation/restore-service.yml` | Recrée un service depuis son image (état sain connu) et attend son healthcheck — attaque B | ✅ |

Les playbooks `remediation/` sont la **seule** façon dont le moteur de remédiation (WOR-38, `services/remediation`) agit sur la plateforme : liste fermée, paramètres validés, pas d'accès brut au socket Docker. `deploy.yml` crée aussi la liste de blocage, la clé HMAC des alertes (`infra/secrets/remediation/hmac_key`) et démarre le moteur (`scripts/start-remediation.sh`).

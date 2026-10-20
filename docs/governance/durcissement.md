# Durcissement des composants et des accès (WOR-63)

Critère jury « accès et composants maîtrisés » (Axe 2). Chaque service applique le **moindre
privilège** ; la posture est **vérifiée automatiquement** par `ansible/playbooks/verify.yml`
(tâche « Tous les conteneurs durcis »), donc reproductible et prouvable le jour de la démo.

## Posture par conteneur

| Service | Utilisateur | `no-new-privileges` | Capacités Linux | Réseaux | Exposition |
|---|---|---|---|---|---|
| postgres | postgres (su-exec) | oui | `drop ALL` + `CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID` | `backend` (internal) | aucune |
| waf | nginx (non-root) | oui | `drop ALL` | `edge`, `backend` | `WAF_BIND:8080` |
| vault | vault | oui | `drop ALL` | `secrets` | `127.0.0.1:8200` |
| vault-agent | vault | oui | `drop ALL` | `secrets` | aucune |
| prometheus | nobody | oui | `drop ALL` | `monitoring` | `127.0.0.1:9090` |
| loki | 10001 | oui | `drop ALL` | `monitoring` | `127.0.0.1:3100` |
| grafana | 472 | oui | `drop ALL` | `monitoring` | `GRAFANA_BIND:3000` |
| alloy | 473 | oui | `drop ALL` | `docker-api`, `monitoring` | aucune |
| socket-proxy | 65534 | oui | `drop ALL`, **rootfs read-only** | `docker-api` (internal) | aucune |

## Principes appliqués

- **Conteneurs non-root** : chaque service tourne sous un utilisateur dédié non privilégié
  (postgres bascule via su-exec après préparation du datadir).
- **Images minimales et figées** : versions épinglées (cf `infra/README.md`), variantes `alpine`
  ou distroless (loki) ; une seule image multi-usage pour Vault/agent.
- **Capacités limitées** : `cap_drop: ALL` partout ; seules les capacités strictement nécessaires
  sont réintroduites (postgres : 5 capacités pour `chown`/`su-exec` du datadir).
- **Pas d'élévation de privilège** : `no-new-privileges` sur tous les conteneurs.
- **Réseaux segmentés** : `backend` et `docker-api` sont `internal` (aucun accès sortant,
  aucun port publiable) ; seuls le WAF (entrée appli), Grafana et Vault/Prometheus/Loki
  (sur 127.0.0.1) publient un port. PostgreSQL n'est jamais publié.
- **Socket Docker** : jamais monté dans un service applicatif ; Alloy passe par `socket-proxy`
  (lecture seule, rootfs read-only, `GET` restreints) — cf `infra/README.md`.
- **Limites de ressources** : CPU et mémoire bornés par service (amortit un DoS, scénario A).
- **Secrets** : jamais en clair ni en variable d'environnement (Vault + fichiers `*_FILE`,
  cf [WOR-62], vérifié par `verify.yml`).

## Exceptions assumées (justifiées)

- **postgres** garde 5 capacités (`CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID`) : l'entrypoint
  officiel prépare le répertoire de données puis abandonne les droits. Les retirer empêche le
  démarrage.
- **rootfs en lecture seule** n'est activé que sur `socket-proxy` pour l'instant ; l'étendre aux
  autres services demande de déclarer leurs répertoires temporaires en tmpfs — amélioration
  possible, non bloquante pour la démo.

## Vérification

```bash
cd ansible && ansible-playbook playbooks/verify.yml
```

La tâche échoue si un conteneur du projet n'a pas `no-new-privileges` **ou** `cap_drop: ALL`.

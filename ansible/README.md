# ansible/ — Automatisation (déploiement, relance, remédiation)

Responsable Infrastructure : Reza. Playbooks appelés par le moteur de remédiation (WOR-38, WOR-44).

- `inventory/` — hôtes (PC Hôte, PC IA)
- `playbooks/` — deploy, verify, teardown ; à venir : restart propre, restauration (données/config), reset known-good (WOR-90)
- `playbooks/tasks/vault-bootstrap.yml` — initialisation, descellement et configuration de Vault (WOR-62)
- `playbooks/vault-user.yml` — compte Vault e-mail + mot de passe pour l'accès humain à l'UI (WOR-62)

## Utilisation

Prérequis : Ansible ≥ 2.17 (`pipx install ansible-core` ou paquet de la distribution), Docker + Compose ≥ 2.20.

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml -p ./collections   # une seule fois
ansible-playbook playbooks/deploy.yml
```

Détail des playbooks : [playbooks/README.md](playbooks/README.md). Description de la stack : [../infra/README.md](../infra/README.md).

## Ansible vs Docker Compose

- **Docker Compose** décrit *ce qui tourne* : services, réseaux, volumes, healthchecks, limites.
- **Ansible** automatise *comment on le déploie et le répare* : prérequis, génération des secrets,
  lancement, vérification fonctionnelle, et demain les actions de remédiation déclenchées par le moteur.
  Le moteur de remédiation n'appellera qu'une liste fermée de playbooks plutôt que d'avoir un accès brut au socket Docker.

# Workshop2026

Lien du drive: https://drive.google.com/drive/folders/1U6b8GWQVU8LXfAwV5N9v2cItiaP0pyOv

## Démarrage rapide — installer et lancer la plateforme

À faire sur le **PC Hôte** (Linux). Comptez 5 minutes, dont 2 à 3 de téléchargement d'images au premier lancement.

### 1. Prérequis (une fois par machine)

```bash
# Docker Engine + plugin Compose ≥ 2.20 : https://docs.docker.com/engine/install/
sudo usermod -aG docker $USER        # puis se déconnecter / reconnecter
docker run --rm hello-world          # doit fonctionner sans sudo

# Ansible ≥ 2.17
sudo apt install ansible-core        # Ubuntu ≥ 25.04 ; vérifier avec : ansible --version
# si la version de la distribution est < 2.17 (ex. Ubuntu 24.04) :
#   sudo apt install pipx && pipx ensurepath && pipx install ansible-core
```

### 2. Tout installer et démarrer — une commande

```bash
git clone git@github.com:CedricSanchezGithub/Workshop2026.git
cd Workshop2026
./scripts/setup.sh
```

Le script vérifie les prérequis, installe la collection Ansible, déploie et vérifie toute la plateforme
(Vault, secrets, PostgreSQL, Prometheus, Loki + Alloy, Grafana), puis **propose de créer votre compte Vault**
(adresse e-mail + mot de passe saisis au clavier). Il est relançable sans risque.

<details>
<summary>Équivalent étape par étape</summary>

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml -p ./collections   # une seule fois
ansible-playbook playbooks/deploy.yml       # déploie + vérifie
ansible-playbook playbooks/vault-user.yml   # crée votre compte Vault
```
</details>

### 3. Accéder aux services

| Service | URL | Connexion |
|---|---|---|
| **Grafana** | http://127.0.0.1:3000 | `admin` — mot de passe : `docker compose -f infra/docker-compose.yml exec grafana cat /run/secrets/grafana/admin_password` |
| **Vault** | http://127.0.0.1:8200/ui | méthode **Username** : partie de votre e-mail **avant `@`** + votre mot de passe |
| **Prometheus** | http://127.0.0.1:9090 | — |
| **Journaux (Loki)** | Grafana → **Explore** → Loki | ex. `{container="postgres"}` |

Chaque membre crée **son propre** compte Vault : `cd ansible && ansible-playbook playbooks/vault-user.yml`
sur le PC Hôte (les comptes appartiennent au Vault de cette machine).

### 4. Au quotidien (depuis `ansible/`)

| Besoin | Commande |
|---|---|
| Après un redémarrage du PC (Vault redémarre **scellé**) | `ansible-playbook playbooks/deploy.yml` |
| Appliquer une modification de configuration (`infra/…`) | `ansible-playbook playbooks/deploy.yml` |
| Vérifier que tout répond | `ansible-playbook playbooks/verify.yml` |
| Créer un compte Vault / réinitialiser son mot de passe | `ansible-playbook playbooks/vault-user.yml` |
| Arrêter (données conservées) | `ansible-playbook playbooks/teardown.yml` |
| Tout effacer (données, secrets, comptes Vault) | `ansible-playbook playbooks/teardown.yml -e purge=true` |
| Ouvrir Grafana au PC Attaquant (jour de la démo) | `GRAFANA_BIND=192.168.137.1` dans `infra/.env`, puis `deploy.yml` |

Un simple `docker compose up` **ne suffit pas** : Vault doit être descellé. Passez toujours par `deploy.yml`.

### 5. Dépannage

| Symptôme | Solution |
|---|---|
| `permission denied … docker.sock` | Ajouter l'utilisateur au groupe `docker` (étape 1), puis se reconnecter |
| `requires_ansible >=2.17` ou « ansible-core trop ancien » | Installer Ansible via `pipx` (étape 1) |
| « Vault est déjà initialisé mais … vault-init.json est absent » | Les clés locales ont été perdues : `teardown.yml -e purge=true` puis `deploy.yml` (repart de zéro) |
| Grafana / Vault inaccessibles après un redémarrage | `deploy.yml` (redescelle Vault, relance ce qui manque) |
| Un port est déjà utilisé (3000, 8200, 9090, 3100) | Arrêter le service local qui l'occupe |

**Ne jamais commiter** `infra/.env` ni `infra/secrets/` (clés de Vault) — ils sont ignorés par Git.
Détails techniques : [infra/README.md](infra/README.md) · [ansible/README.md](ansible/README.md).

## Répartition des domaines

Chaque pilier a un responsable. Les décisions d'architecture restent prises ensemble.

| Domaine | Responsable | Projet Linear |
|---|---|---|
| Développement | Michael | Développement — SI de paiement & remédiation |
| Infrastructure | Reza | Infrastructure & Observabilité |
| IA / Data | Léa | IA / Data — Détection ML & Assistant RAG |
| Cybersécurité | Axel | Cybersécurité — Red Team & Défense |
| Gouvernance / Transformation | Cédric | Gouvernance & Transformation |

## Structure du dépôt

| Dossier | Contenu | Responsable |
|---|---|---|
| `services/` | Microservices du SI de paiement + moteur de remédiation + dashboard | Michael |
| `infra/` | Docker Compose, Prometheus, Grafana, Loki, WAF | Reza |
| `ansible/` | Playbooks (déploiement, relance, remédiation) | Reza |
| `ml/` | Détection d'anomalies (données, features, entraînement, inférence) | Léa |
| `rag/` | Assistant opérateur local (Ollama + LangChain) | Léa |
| `attack/` | Scénarios offensifs A (DoS) et B (injection) | Axel |
| `scripts/` | Utilitaires (reset known-good…) | — |
| `docs/` | Architecture, ADR, gouvernance, spéc d'attaque, checklist | Cédric |

Chaque dossier contient un `README.md` qui détaille son contenu et les tickets Linear associés.
Convention : aucun secret en clair dans le dépôt (cf `.gitignore`).

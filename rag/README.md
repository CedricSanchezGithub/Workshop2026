# rag/ — Assistant opérateur local (Ollama + LangChain)

Responsable IA / Data : Léa. Modèle local ≤ 8B paramètres (WOR-55).

- Indexe procédures, architecture, PCA/PRA, docs de l'équipe (WOR-56)
- Aide à comprendre l'incident et à consulter les procédures
- **N'EST PAS** l'automate de remédiation, aucun accès privilégié sans contrôle (WOR-57)

L'index vectoriel (`vectorstore/`) est régénérable → non versionné (.gitignore).

## Mise en œuvre

- `assistant/ingest.py` indexe `docs/**/*.md|pdf` par section dans Chroma (collection `resilience-docs`). L'API le lance elle-même au démarrage, en arrière-plan, et réessaie tant qu'Ollama ne répond pas.
- `assistant/reports.py` suit les **rapports d'incident** écrits par le moteur de remédiation (`services/remediation/data/reports/`, monté en lecture seule) et les indexe au fil de l'eau (toutes les 15 s, collection `incident-reports`, un rapport = un extrait).
- `assistant/app.py` : `POST /ask` (réponse + sources citées), `/health` (Ollama, modèles, index), `/live` (healthcheck), page de test sur `/`. Lecture seule, sans outil ; si aucun extrait n'est pertinent (score < 0,50), répond « je ne trouve rien » sans appeler le LLM.
- LLM `qwen2.5:7b` (7 Md de paramètres) ; embeddings `bge-m3` (multilingue, retenu car `nomic-embed-text` ne séparait pas les questions hors sujet en français). Modèles gardés en mémoire GPU 4 h (`LLM_KEEP_ALIVE_S`).

### Questions sur un incident (« le site était lent il y a 5 minutes ? »)

La recherche vectorielle ne connaît pas l'heure. Trois mécanismes :
1. Les rapports donnent des heures absolues et décrivent les symptômes en clair (« site lent », « requêtes refusées »).
2. L'heure actuelle (Europe/Paris) est donnée au modèle avec chaque question.
3. Si la question porte sur un événement (« il y a », « tout à l'heure », « lent », « panne », « incident », « slow », « ago »…), les rapports des 2 dernières heures sont ajoutés au contexte **par date**, les plus récents d'abord (`RAG_RECENT_WINDOW_S`). S'il n'y en a aucun, l'assistant le dit (« aucun incident ni alerte enregistré entre … et … »).

Rapports couverts : chaque incident traité (symptômes, IP, actions, durée, issue, fin des symptômes) et chaque alerte ignorée pendant la stabilisation qui suit une restauration.

### Lancer

Service `assistant` du compose principal, démarré par `ansible-playbook playbooks/deploy.yml` (page : `http://<ASSISTANT_BIND>:8100`). Conteneur isolé : réseau dédié sans accès à la plateforme, docs et rapports en lecture seule, FS read-only, sans socket Docker ni capabilities.

Ollama tourne sur l'hôte (`ollama pull qwen2.5:7b && ollama pull bge-m3`) et doit être joignable depuis le conteneur (`host.docker.internal:11434`) :
- **Windows / Docker Desktop** : rien à faire.
- **Linux** : Ollama n'écoute que sur 127.0.0.1 par défaut. `sudo systemctl edit ollama`, ajouter
  `[Service]` puis `Environment="OLLAMA_HOST=0.0.0.0:11434"`, puis `sudo systemctl restart ollama`. Le pare-feu (ufw, refus par défaut) bloque le port 11434 depuis le réseau.

En développement, sans conteneur :

```bash
cd rag && uv sync
uv run uvicorn assistant.app:app --port 8100      # indexe docs/ au démarrage ; page : http://localhost:8100
uv run pytest
```

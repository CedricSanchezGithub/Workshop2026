# rag/ — Assistant opérateur local (Ollama + LangChain)

Responsable IA / Data : Léa. Modèle local ≤ 8B paramètres (WOR-55).

- Indexe procédures, architecture, PCA/PRA, docs de l'équipe (WOR-56)
- Aide à comprendre l'incident et à consulter les procédures
- **N'EST PAS** l'automate de remédiation, aucun accès privilégié sans contrôle (WOR-57)

L'index vectoriel (`vectorstore/`) est régénérable → non versionné (.gitignore).

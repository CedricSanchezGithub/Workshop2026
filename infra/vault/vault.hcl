# Serveur HashiCorp Vault (WOR-62) — un seul nœud, stockage intégré (raft) sur volume.
# Initialisé, descellé et configuré par ansible/playbooks/tasks/vault-bootstrap.yml.

ui = true

# Le conteneur tourne sans capacité Linux (cap_drop: ALL) : pas d'IPC_LOCK.
# Recommandé de toute façon avec le stockage intégré.
disable_mlock = true

storage "raft" {
  path    = "/vault/file"
  node_id = "vault-1"
}

# TLS désactivé : Vault n'est joignable que sur le réseau Docker "secrets"
# et sur 127.0.0.1 du PC Hôte (limite assumée du prototype).
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr     = "http://vault:8200"
cluster_addr = "http://vault:8201"

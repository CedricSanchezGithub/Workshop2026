# Politique "admin" (WOR-62) : administration courante de Vault par un humain (connexion
# e-mail + mot de passe), pour ne plus utiliser le jeton root au quotidien.
# Inspirée de la politique d'administration proposée par HashiCorp.

# Secrets de la plateforme (KV v2)
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Méthodes d'authentification et comptes (dont changement de son propre mot de passe)
path "auth/*" {
  capabilities = ["create", "read", "update", "delete", "list", "sudo"]
}
path "sys/auth" {
  capabilities = ["read"]
}
path "sys/auth/*" {
  capabilities = ["create", "update", "delete", "sudo"]
}

# Politiques
path "sys/policies/acl" {
  capabilities = ["list"]
}
path "sys/policies/acl/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Moteurs de secrets
path "sys/mounts" {
  capabilities = ["read"]
}
path "sys/mounts/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Lecture de l'état et des journaux d'audit configurés
path "sys/health" {
  capabilities = ["read", "sudo"]
}
path "sys/audit" {
  capabilities = ["read", "sudo"]
}

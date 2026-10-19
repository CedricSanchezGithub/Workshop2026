# Vault Agent (WOR-62) : s'authentifie par AppRole et écrit chaque secret dans un fichier,
# sur un volume en mémoire (tmpfs) monté en lecture seule par le seul service concerné.
# Les services lisent leurs secrets au démarrage via les variables *_FILE.

vault {
  address = "http://vault:8200"
}

auto_auth {
  method "approle" {
    config = {
      role_id_file_path                   = "/vault/approle/role_id"
      secret_id_file_path                 = "/vault/approle/secret_id"
      remove_secret_id_file_after_reading = false
    }
  }
}

template_config {
  # Vault indisponible ou scellé : l'agent réessaie au lieu de s'arrêter
  exit_on_retry_failure         = false
  static_secret_render_interval = "1m"
}

template {
  destination          = "/secrets/postgres/password"
  contents             = "{{ with secret \"secret/data/platform/postgres\" }}{{ .Data.data.password }}{{ end }}"
  perms                = "0444"
  error_on_missing_key = true
}

template {
  destination          = "/secrets/grafana/admin_password"
  contents             = "{{ with secret \"secret/data/platform/grafana\" }}{{ .Data.data.admin_password }}{{ end }}"
  perms                = "0444"
  error_on_missing_key = true
}

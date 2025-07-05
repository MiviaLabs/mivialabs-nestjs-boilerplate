ui = true

# PostgreSQL storage backend
storage "postgresql" {
  connection_url = "postgres://vault:__VAULT_DB_PASSWORD__@vault-postgres:5432/vault?sslmode=disable"
  table          = "vault_kv_store"
  max_parallel   = 128
}

# HTTPS listener
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/vault/certs/vault.crt"
  tls_key_file  = "/vault/certs/vault.key"
  tls_min_version = "tls12"
}

# Cluster listener for HA
listener "tcp" {
  address       = "0.0.0.0:8201"
  cluster_use_tls = true
  tls_cert_file = "/vault/certs/vault.crt"
  tls_key_file  = "/vault/certs/vault.key"
  tls_min_version = "tls12"
}

# API and cluster addresses
api_addr     = "https://vault:8200"
cluster_addr = "https://vault:8201"

# Disable memory lock for containerized environment
disable_mlock = false

# Enable raw endpoint (optional, for health checks)
raw_storage_endpoint = true

# Log level
log_level = "INFO"

# Telemetry (optional)
telemetry {
  disable_hostname = true
  prometheus_retention_time = "12h"
} 
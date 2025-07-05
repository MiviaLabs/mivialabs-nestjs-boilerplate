#!/bin/bash
set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting Vault production setup..."

# Read database password from secret
if [ -f /run/secrets/vault_db_password ]; then
    VAULT_DB_PASSWORD=$(cat /run/secrets/vault_db_password)
    export VAULT_DB_PASSWORD
else
    log "ERROR: Database password secret not found!"
    exit 1
fi

# Create config directory if it doesn't exist
mkdir -p /vault/config

# Copy and process the configuration template
if [ -f /vault/config/vault.hcl ]; then
    log "Processing Vault configuration..."
    # Replace placeholder with actual password
    sed "s/__VAULT_DB_PASSWORD__/${VAULT_DB_PASSWORD}/g" /vault/config/vault.hcl > /tmp/vault.hcl
    export VAULT_CONFIG_PATH="/tmp/vault.hcl"
else
    log "Using inline configuration from environment..."
    # Use the VAULT_LOCAL_CONFIG if no file is provided
    echo "${VAULT_LOCAL_CONFIG}" | sed "s/VAULT_DB_PASSWORD/${VAULT_DB_PASSWORD}/g" > /tmp/vault.hcl
    export VAULT_CONFIG_PATH="/tmp/vault.hcl"
fi

# Verify certificates exist
if [ ! -f /vault/certs/vault.crt ] || [ ! -f /vault/certs/vault.key ]; then
    log "WARNING: TLS certificates not found. Vault will fail to start."
    log "Please generate certificates before starting Vault."
    log "You can use the generate-certs.sh script."
fi

# Set proper permissions
chmod 600 /tmp/vault.hcl

log "Starting Vault server..."
log "Configuration file: ${VAULT_CONFIG_PATH}"

# Start Vault with the processed configuration
exec vault server -config="${VAULT_CONFIG_PATH}" 
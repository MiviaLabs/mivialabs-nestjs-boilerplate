#!/bin/bash
set -e

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] VAULT-INIT: $1"
}

# Function to wait for Vault to be ready
wait_for_vault() {
    local max_attempts=30
    local attempt=1
    
    log "Waiting for Vault to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if vault status -address="${VAULT_ADDR}" -ca-cert=/vault/certs/ca.crt > /dev/null 2>&1; then
            log "Vault is ready!"
            return 0
        fi
        
        log "Attempt $attempt/$max_attempts: Vault not ready yet, waiting..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    log "ERROR: Vault did not become ready after $max_attempts attempts"
    return 1
}

# Check if Vault is already initialized
check_vault_status() {
    local status_output
    status_output=$(vault status -address="${VAULT_ADDR}" -ca-cert=/vault/certs/ca.crt -format=json 2>/dev/null || echo '{}')
    
    if echo "$status_output" | grep -q '"initialized":true'; then
        log "Vault is already initialized"
        return 0
    else
        log "Vault is not initialized"
        return 1
    fi
}

# Initialize Vault
initialize_vault() {
    log "Initializing Vault..."
    
    local init_output
    init_output=$(vault operator init \
        -address="${VAULT_ADDR}" \
        -ca-cert=/vault/certs/ca.crt \
        -key-shares=5 \
        -key-threshold=3 \
        -format=json)
    
    # Save initialization output
    echo "$init_output" > /vault/init/vault-init.json
    chmod 600 /vault/init/vault-init.json
    
    # Extract unseal keys and root token
    echo "$init_output" | jq -r '.unseal_keys_b64[]' > /vault/init/unseal-keys.txt
    echo "$init_output" | jq -r '.root_token' > /vault/init/root-token.txt
    
    chmod 600 /vault/init/unseal-keys.txt
    chmod 600 /vault/init/root-token.txt
    
    log "Vault initialized successfully!"
    log "Unseal keys and root token saved to /vault/init/"
    log "IMPORTANT: Please secure these files immediately!"
    
    return 0
}

# Unseal Vault
unseal_vault() {
    log "Unsealing Vault..."
    
    if [ ! -f /vault/init/unseal-keys.txt ]; then
        log "ERROR: Unseal keys not found!"
        return 1
    fi
    
    # Read first 3 unseal keys (threshold)
    local unseal_keys
    unseal_keys=$(head -3 /vault/init/unseal-keys.txt)
    
    local key_count=1
    while IFS= read -r key; do
        if [ -n "$key" ]; then
            log "Using unseal key $key_count/3..."
            vault operator unseal \
                -address="${VAULT_ADDR}" \
                -ca-cert=/vault/certs/ca.crt \
                "$key"
            key_count=$((key_count + 1))
        fi
    done <<< "$unseal_keys"
    
    log "Vault unsealed successfully!"
}

# Main execution
main() {
    log "Starting Vault initialization process..."
    
    # Create init directory
    mkdir -p /vault/init
    
    # Wait for Vault to be ready
    if ! wait_for_vault; then
        exit 1
    fi
    
    # Check if already initialized
    if check_vault_status; then
        log "Vault is already initialized, attempting to unseal..."
        if ! unseal_vault; then
            log "Failed to unseal Vault"
            exit 1
        fi
    else
        # Initialize Vault
        if initialize_vault; then
            # Unseal after initialization
            if ! unseal_vault; then
                log "Failed to unseal Vault after initialization"
                exit 1
            fi
        else
            log "Failed to initialize Vault"
            exit 1
        fi
    fi
    
    # Verify final status
    log "Verifying Vault status..."
    vault status -address="${VAULT_ADDR}" -ca-cert=/vault/certs/ca.crt
    
    log "Vault initialization completed successfully!"
    log "You can now access Vault at: ${VAULT_ADDR}"
    log "Root token location: /vault/init/root-token.txt"
    log "Unseal keys location: /vault/init/unseal-keys.txt"
    log ""
    log "SECURITY WARNING:"
    log "- Store the root token and unseal keys securely"
    log "- Remove or encrypt these files after securing them elsewhere"
    log "- Consider using auto-unseal mechanisms for production"
}

# Run main function
main "$@" 
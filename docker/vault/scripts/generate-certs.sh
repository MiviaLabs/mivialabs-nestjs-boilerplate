#!/bin/bash
set -e

# Configuration
CERT_DIR="docker/vault/certs"
CA_KEY="$CERT_DIR/ca.key"
CA_CERT="$CERT_DIR/ca.crt"
VAULT_KEY="$CERT_DIR/vault.key"
VAULT_CERT="$CERT_DIR/vault.crt"
VAULT_CSR="$CERT_DIR/vault.csr"

# Certificate details
CA_SUBJECT="/C=US/ST=CA/L=San Francisco/O=Vault Development/CN=Vault CA"
VAULT_SUBJECT="/C=US/ST=CA/L=San Francisco/O=Vault Development/CN=vault"

# Function to log messages
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] CERT-GEN: $1"
}

# Create certificates directory
mkdir -p "$CERT_DIR"

log "Generating TLS certificates for Vault..."

# Generate CA private key
log "Generating CA private key..."
openssl genrsa -out "$CA_KEY" 4096

# Generate CA certificate
log "Generating CA certificate..."
openssl req -new -x509 -days 365 -key "$CA_KEY" -out "$CA_CERT" \
    -subj "$CA_SUBJECT"

# Generate Vault private key
log "Generating Vault private key..."
openssl genrsa -out "$VAULT_KEY" 4096

# Generate Vault certificate signing request
log "Generating Vault CSR..."
openssl req -new -key "$VAULT_KEY" -out "$VAULT_CSR" \
    -subj "$VAULT_SUBJECT"

# Create extensions file for Subject Alternative Names
cat > "$CERT_DIR/vault.ext" << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = vault
DNS.2 = vault-prod
DNS.3 = localhost
DNS.4 = *.vault.local
IP.1 = 127.0.0.1
IP.2 = 0.0.0.0
EOF

# Generate Vault certificate signed by CA
log "Generating Vault certificate..."
openssl x509 -req -in "$VAULT_CSR" -CA "$CA_CERT" -CAkey "$CA_KEY" \
    -CAcreateserial -out "$VAULT_CERT" -days 365 \
    -extensions v3_req -extfile "$CERT_DIR/vault.ext"

# Set proper permissions
chmod 600 "$CA_KEY" "$VAULT_KEY"
chmod 644 "$CA_CERT" "$VAULT_CERT"

# Clean up temporary files
rm -f "$VAULT_CSR" "$CERT_DIR/vault.ext" "$CERT_DIR/ca.srl"

log "Certificate generation completed!"
log "Files created:"
log "  CA Certificate: $CA_CERT"
log "  CA Private Key: $CA_KEY"
log "  Vault Certificate: $VAULT_CERT"
log "  Vault Private Key: $VAULT_KEY"
log ""
log "Certificate details:"
openssl x509 -in "$VAULT_CERT" -text -noout | grep -A 1 "Subject:"
openssl x509 -in "$VAULT_CERT" -text -noout | grep -A 10 "Subject Alternative Name"
log ""
log "To trust the CA certificate on your system:"
log "  - Linux: sudo cp $CA_CERT /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
log "  - macOS: sudo security add-trusted-cert -d root -r trustRoot -k /Library/Keychains/System.keychain $CA_CERT"
log "  - Windows: Import $CA_CERT to 'Trusted Root Certification Authorities'" 
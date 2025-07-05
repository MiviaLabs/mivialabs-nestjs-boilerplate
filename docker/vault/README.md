# HashiCorp Vault Production Setup

This directory contains a production-ready HashiCorp Vault configuration with PostgreSQL storage backend.

## 🏗️ Architecture

- **HashiCorp Vault**: Secrets management server with TLS encryption
- **PostgreSQL**: Persistent storage backend for Vault data
- **TLS Security**: Full encryption in transit with self-signed certificates
- **Auto-initialization**: Automated Vault initialization and unsealing

## 📁 Directory Structure

```
docker/vault/
├── README.md                    # This file
├── certs/                       # TLS certificates (generated)
│   ├── ca.crt                  # Certificate Authority
│   ├── ca.key                  # CA Private Key
│   ├── vault.crt               # Vault Certificate
│   └── vault.key               # Vault Private Key
├── config/
│   └── vault.hcl               # Vault configuration file
├── scripts/
│   ├── generate-certs.sh       # Certificate generation script
│   ├── vault-entrypoint.sh     # Vault startup script
│   └── vault-init.sh           # Vault initialization script
├── secrets/
│   └── vault_db_password.txt   # Database password
└── init-vault-db.sql           # PostgreSQL initialization
```

## 🚀 Quick Start

### 1. Generate TLS Certificates

First, generate the required TLS certificates:

```bash
./docker/vault/scripts/generate-certs.sh
```

This creates self-signed certificates for development/testing. For production, use certificates from a trusted CA.

### 2. Configure Database Password

Edit the database password in `docker/vault/secrets/vault_db_password.txt`:

```bash
# Generate a secure password
openssl rand -base64 32 > docker/vault/secrets/vault_db_password.txt
```

### 3. Start the Services

```bash
# Start PostgreSQL and Vault
docker-compose -f docker-compose.prod.yml up -d vault-postgres vault

# Wait for services to be healthy, then initialize Vault
docker-compose -f docker-compose.prod.yml up vault-init
```

### 4. Access Vault

- **Web UI**: https://localhost:8200
- **API**: https://localhost:8200/v1/
- **Health Check**: https://localhost:8200/v1/sys/health

## 🔐 Security Features

### TLS Encryption
- All communication encrypted with TLS 1.2+
- Self-signed CA for development
- Mutual TLS support for clustering

### Authentication
- Root token stored securely in `/vault/init/root-token.txt`
- Unseal keys stored in `/vault/init/unseal-keys.txt`
- 5 unseal keys with 3-key threshold

### Storage Security
- PostgreSQL backend with encrypted connections
- Database credentials managed via Docker secrets
- Persistent volumes for data retention

### Network Security
- Isolated Docker network
- No unnecessary port exposure
- Health checks for service monitoring

## 🔧 Configuration

### Vault Configuration (vault.hcl)

The main configuration includes:

- **Storage**: PostgreSQL backend with connection pooling
- **Listeners**: HTTPS on port 8200, cluster on 8201
- **Security**: TLS 1.2+ minimum, memory locking enabled
- **Telemetry**: Prometheus metrics support

### Environment Variables

Key environment variables:

- `VAULT_ADDR`: https://vault:8200
- `VAULT_API_ADDR`: https://vault:8200
- `VAULT_CLUSTER_ADDR`: https://vault:8201

## 📊 Monitoring & Health Checks

### Health Checks
- **PostgreSQL**: `pg_isready` check every 10s
- **Vault**: `vault status` check every 30s
- **Startup time**: 60s grace period for Vault

### Logs
- Vault logs: `docker logs vault-prod`
- PostgreSQL logs: `docker logs vault-postgres`
- Init logs: `docker logs vault-init`

### Metrics
- Prometheus metrics available at `/v1/sys/metrics`
- Telemetry configured for 12-hour retention

## 🛠️ Management Commands

### Check Vault Status
```bash
# From host
docker exec vault-prod vault status

# Check if sealed
docker exec vault-prod vault status | grep Sealed
```

### Unseal Vault Manually
```bash
# Get unseal keys
docker exec vault-prod cat /vault/init/unseal-keys.txt

# Unseal (repeat 3 times with different keys)
docker exec vault-prod vault operator unseal <KEY>
```

### Access Vault CLI
```bash
# Get root token
ROOT_TOKEN=$(docker exec vault-prod cat /vault/init/root-token.txt)

# Login and use CLI
docker exec -it vault-prod sh
export VAULT_TOKEN=$ROOT_TOKEN
vault auth list
vault secrets list
```

### Backup and Restore
```bash
# Backup PostgreSQL data
docker exec vault-postgres pg_dump -U vault vault > vault-backup.sql

# Restore PostgreSQL data
docker exec -i vault-postgres psql -U vault vault < vault-backup.sql
```

## 🔒 Production Considerations

### Security Hardening

1. **Replace Self-Signed Certificates**
   - Use certificates from trusted CA
   - Implement certificate rotation
   - Use Let's Encrypt for public endpoints

2. **Secure Unseal Keys**
   - Store unseal keys in separate secure locations
   - Consider using auto-unseal with cloud HSM/KMS
   - Implement key rotation procedures

3. **Database Security**
   - Use strong database passwords
   - Enable SSL for database connections
   - Implement database backup encryption

4. **Network Security**
   - Use TLS for all communications
   - Implement network segmentation
   - Use reverse proxy with rate limiting

### High Availability

1. **Vault Clustering**
   - Deploy multiple Vault instances
   - Configure shared storage backend
   - Implement load balancing

2. **Database HA**
   - Use PostgreSQL streaming replication
   - Implement automatic failover
   - Regular backup verification

3. **Monitoring**
   - Implement comprehensive monitoring
   - Set up alerting for critical events
   - Log aggregation and analysis

### Backup Strategy

1. **Database Backups**
   - Regular automated backups
   - Test restore procedures
   - Offsite backup storage

2. **Configuration Backups**
   - Version control all configurations
   - Backup encryption keys securely
   - Document recovery procedures

## 🐛 Troubleshooting

### Common Issues

1. **Vault Won't Start**
   ```bash
   # Check certificates
   ls -la docker/vault/certs/
   
   # Check database connectivity
   docker exec vault-postgres pg_isready -U vault
   
   # Check logs
   docker logs vault-prod
   ```

2. **Can't Access Web UI**
   - Verify certificates are generated
   - Check if vault is unsealed
   - Verify port forwarding

3. **Database Connection Issues**
   - Check PostgreSQL is running and healthy
   - Verify database password
   - Check network connectivity

### Log Analysis
```bash
# Vault logs
docker logs vault-prod --tail 100 -f

# Database logs
docker logs vault-postgres --tail 100 -f

# Initialization logs
docker logs vault-init
```

### Reset Everything
```bash
# Stop and remove all containers
docker-compose -f docker-compose.prod.yml down -v

# Remove all data (WARNING: This deletes everything!)
docker volume rm $(docker volume ls -q | grep vault)

# Start fresh
docker-compose -f docker-compose.prod.yml up -d
```

## 📚 Additional Resources

- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [Vault API Documentation](https://www.vaultproject.io/api-docs)
- [Production Hardening Guide](https://learn.hashicorp.com/tutorials/vault/production-hardening)
- [PostgreSQL Storage Backend](https://www.vaultproject.io/docs/configuration/storage/postgresql)

## ⚠️ Important Notes

1. **This configuration is for development/testing**
2. **Change all default passwords before production use**
3. **Secure unseal keys and root tokens immediately**
4. **Implement proper backup and disaster recovery**
5. **Regular security audits and updates**
6. **Monitor vault and database performance**

For production deployment, consult with security experts and follow your organization's security policies. 
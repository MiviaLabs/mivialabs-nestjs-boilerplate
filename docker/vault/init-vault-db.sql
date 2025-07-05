-- Initialize Vault database
-- This script creates the necessary database and user for Vault

-- Ensure the vault database exists (it should be created by POSTGRES_DB)
-- Create necessary tables for Vault (Vault will create these automatically)

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE vault TO vault;

-- Create the vault_kv_store table that Vault will use
-- Note: Vault will create its own tables, but we can ensure proper permissions
\c vault;

-- Ensure the vault user has the necessary privileges
GRANT ALL ON SCHEMA public TO vault;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vault;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vault;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO vault;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO vault; 
import * as argon2 from 'argon2';

/**
 * Verify a password against its hash using argon2
 * @param password - The plain text password to verify
 * @param hash - The hashed password to verify against
 * @param secretHashingKey - Optional secret key used during hashing
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string,
  secretHashingKey?: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password, {
      secret: secretHashingKey
        ? Buffer.from(secretHashingKey, 'base64')
        : undefined,
    });
  } catch {
    // If verification fails due to invalid hash format or other errors
    return false;
  }
}

import * as argon2 from 'argon2';

/**
 * Hash a password using argon2
 * @param password - The password to hash
 * @returns The hashed password
 */
export async function hashPassword(
  password: string,
  secretHashingKey?: string,
): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 19, // 512 MB
    timeCost: 5,
    parallelism: 1,
    secret: secretHashingKey
      ? Buffer.from(secretHashingKey, 'base64')
      : undefined,
  });
}

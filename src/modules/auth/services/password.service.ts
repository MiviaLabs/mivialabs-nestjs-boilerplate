import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly argon2Options: argon2.Options;

  constructor(private readonly configService: ConfigService) {
    this.argon2Options = {
      type: argon2.argon2id,
      memoryCost:
        this.configService.get<number>('ARGON2_MEMORY_COST') || 2 ** 16, // 64MB
      timeCost: this.configService.get<number>('ARGON2_TIME_COST') || 3,
      parallelism: this.configService.get<number>('ARGON2_PARALLELISM') || 1,
      hashLength: this.configService.get<number>('ARGON2_HASH_LENGTH') || 32,
    };
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await argon2.hash(password, this.argon2Options);
    } catch (error) {
      throw new Error(
        `Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async verifyPassword(
    hashedPassword: string,
    plainPassword: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainPassword);
    } catch {
      // Log error for debugging but don't expose internal details
      return false;
    }
  }

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Minimum length
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    // Maximum length (prevent DoS)
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }

    // Must contain at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Must contain at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Must contain at least one number
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Must contain at least one special character
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    if (this.containsCommonPatterns(password)) {
      errors.push('Password contains common patterns and is not secure');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private containsCommonPatterns(password: string): boolean {
    const commonPatterns = [
      /123456/,
      /password/i,
      /qwerty/i,
      /admin/i,
      /letmein/i,
      /welcome/i,
      /monkey/i,
      /dragon/i,
    ];

    return commonPatterns.some((pattern) => pattern.test(password));
  }

  generateRandomPassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const allChars = lowercase + uppercase + numbers + symbols;

    let password = '';

    // Ensure at least one character from each category
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}

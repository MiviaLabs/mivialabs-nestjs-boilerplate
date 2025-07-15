import { Injectable } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  JwtAccessTokenPayload,
  JwtRefreshTokenPayload,
  JwtTokenPair,
} from '../interfaces/jwt-payload.interface';
import { TokenValidationResult } from '../interfaces/token-validation-result.interface';
import { TokenType } from '../enums/token-type.enum';

@Injectable()
export class JwtService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpirationTime: string;
  private readonly refreshTokenExpirationTime: string;

  constructor(
    private readonly nestJwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {
    // Use JWT_SECRET for both access and refresh tokens
    this.jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    this.accessTokenExpirationTime =
      this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '15m';
    this.refreshTokenExpirationTime =
      this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') || '7d';
  }

  async generateTokenPair(
    userId: string,
    organizationId: string,
    refreshTokenId: string,
  ): Promise<JwtTokenPair> {
    const now = new Date();
    const nowMs = now.getTime();
    // Add milliseconds to iat to ensure uniqueness in rapid succession
    const iatWithMs = nowMs / 1000; // Keep millisecond precision

    // Generate access token
    const accessTokenPayload: JwtAccessTokenPayload = {
      sub: userId,
      organizationId,
      iat: iatWithMs,
      exp: Math.floor(
        (nowMs + this.parseExpirationToMs(this.accessTokenExpirationTime)) /
          1000,
      ),
      type: TokenType.ACCESS,
    };

    // Generate refresh token
    const refreshTokenPayload: JwtRefreshTokenPayload = {
      sub: userId,
      organizationId,
      tokenId: refreshTokenId,
      iat: iatWithMs,
      exp: Math.floor(
        (nowMs + this.parseExpirationToMs(this.refreshTokenExpirationTime)) /
          1000,
      ),
      type: TokenType.REFRESH,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.nestJwtService.signAsync(accessTokenPayload, {
        secret: this.jwtSecret,
      }),
      this.nestJwtService.signAsync(refreshTokenPayload, {
        secret: this.jwtSecret,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(accessTokenPayload.exp * 1000),
      refreshTokenExpiresAt: new Date(refreshTokenPayload.exp * 1000),
      expiresIn: Math.floor(accessTokenPayload.exp - accessTokenPayload.iat), // Access token expiry in seconds
    };
  }

  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      const payload =
        await this.nestJwtService.verifyAsync<JwtAccessTokenPayload>(token, {
          secret: this.jwtSecret,
        });

      if (payload.type !== TokenType.ACCESS) {
        return { isValid: false, error: 'Invalid token type' };
      }

      return {
        isValid: true,
        userId: payload.sub,
        organizationId: payload.organizationId,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }

  async validateRefreshToken(token: string): Promise<TokenValidationResult> {
    try {
      const payload =
        await this.nestJwtService.verifyAsync<JwtRefreshTokenPayload>(token, {
          secret: this.jwtSecret,
        });

      if (payload.type !== TokenType.REFRESH) {
        return { isValid: false, error: 'Invalid token type' };
      }

      return {
        isValid: true,
        userId: payload.sub,
        organizationId: payload.organizationId,
        tokenId: payload.tokenId,
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }

  async decodeToken(
    token: string,
  ): Promise<JwtAccessTokenPayload | JwtRefreshTokenPayload | null> {
    try {
      return this.nestJwtService.decode(token);
    } catch {
      return null;
    }
  }

  private parseExpirationToMs(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000; // Default 15 minutes
    }
  }
}

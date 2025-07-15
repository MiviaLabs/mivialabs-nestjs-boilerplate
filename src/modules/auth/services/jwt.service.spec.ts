import { Test, TestingModule } from '@nestjs/testing';
import { JwtService as NestJwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtService } from './jwt.service';
import { TokenType } from '../enums/token-type.enum';
import { JwtAccessTokenPayload } from '../interfaces/jwt-access-token-payload.interface';
import { JwtRefreshTokenPayload } from '../interfaces/jwt-refresh-token-payload.interface';

describe('JwtService', () => {
  let service: JwtService;
  let nestJwtService: jest.Mocked<NestJwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockAccessTokenPayload: JwtAccessTokenPayload = {
    sub: 'user-123',
    organizationId: 'org-456',
    type: TokenType.ACCESS,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  };

  const mockRefreshTokenPayload: JwtRefreshTokenPayload = {
    sub: 'user-123',
    tokenId: 'token-789',
    organizationId: 'org-456',
    type: TokenType.REFRESH,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 604800, // 7 days
  };

  beforeEach(async () => {
    const mockNestJwtService = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtService,
        {
          provide: NestJwtService,
          useValue: mockNestJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<JwtService>(JwtService);
    nestJwtService = module.get(NestJwtService);
    configService = module.get(ConfigService);

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        JWT_ACCESS_TOKEN_EXPIRATION: '15m',
        JWT_REFRESH_TOKEN_EXPIRATION: '7d',
        JWT_SECRET: 'access-secret-key',
        JWT_REFRESH_SECRET: 'refresh-secret-key',
      };
      return config[key as keyof typeof config] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', async () => {
      const userId = 'user-123';
      const organizationId = 'org-456';
      const refreshTokenId = 'token-789';

      nestJwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.generateTokenPair(
        userId,
        organizationId,
        refreshTokenId,
      );

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: expect.any(Date),
        refreshTokenExpiresAt: expect.any(Date),
      });

      expect(nestJwtService.signAsync).toHaveBeenCalledTimes(2);

      // Verify access token payload
      const accessTokenCall = nestJwtService.signAsync.mock.calls[0];
      if (accessTokenCall) {
        expect(accessTokenCall[0]).toMatchObject({
          sub: userId,
          organizationId,
          type: TokenType.ACCESS,
        });
        expect(accessTokenCall[1]).toEqual({
          secret: 'access-secret-key',
        });
      }

      // Verify refresh token payload
      const refreshTokenCall = nestJwtService.signAsync.mock.calls[1];
      if (refreshTokenCall) {
        expect(refreshTokenCall[0]).toMatchObject({
          sub: userId,
          tokenId: refreshTokenId,
          organizationId,
          type: TokenType.REFRESH,
        });
        expect(refreshTokenCall[1]).toEqual({
          secret: 'refresh-secret-key',
        });
      }
    });

    it('should throw error if token generation fails', async () => {
      nestJwtService.signAsync.mockRejectedValue(
        new Error('Token generation failed'),
      );

      await expect(
        service.generateTokenPair('user', 'org', 'token'),
      ).rejects.toThrow('Token generation failed');
    });
  });

  describe('validateAccessToken', () => {
    it('should validate and return access token payload', async () => {
      const token = 'valid-access-token';
      nestJwtService.verifyAsync.mockResolvedValue(mockAccessTokenPayload);

      const result = await service.validateAccessToken(token);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(mockAccessTokenPayload.sub);
      expect(result.organizationId).toBe(mockAccessTokenPayload.organizationId);

      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: 'access-secret-key',
      });
    });

    it('should return invalid result for expired token', async () => {
      const token = 'expired-token';
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      nestJwtService.verifyAsync.mockRejectedValue(error);

      const result = await service.validateAccessToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Token expired');
    });

    it('should return invalid result for malformed token', async () => {
      const token = 'malformed-token';
      const error = new Error('Invalid token');
      error.name = 'JsonWebTokenError';
      nestJwtService.verifyAsync.mockRejectedValue(error);

      const result = await service.validateAccessToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should return invalid result for wrong token type', async () => {
      const token = 'refresh-token-as-access';
      const refreshPayload = { ...mockRefreshTokenPayload };
      nestJwtService.verifyAsync.mockResolvedValue(refreshPayload);

      const result = await service.validateAccessToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token type');
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate and return refresh token payload', async () => {
      const token = 'valid-refresh-token';
      nestJwtService.verifyAsync.mockResolvedValue(mockRefreshTokenPayload);

      const result = await service.validateRefreshToken(token);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(mockRefreshTokenPayload.sub);
      expect(result.tokenId).toBe(mockRefreshTokenPayload.tokenId);
      expect(result.organizationId).toBe(
        mockRefreshTokenPayload.organizationId,
      );

      expect(nestJwtService.verifyAsync).toHaveBeenCalledWith(token, {
        secret: 'refresh-secret-key',
      });
    });

    it('should return invalid result for wrong token type', async () => {
      const token = 'access-token-as-refresh';
      const accessPayload = { ...mockAccessTokenPayload };
      nestJwtService.verifyAsync.mockResolvedValue(accessPayload);

      const result = await service.validateRefreshToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid token type');
    });

    it('should handle verification errors gracefully', async () => {
      const token = 'invalid-token';
      nestJwtService.verifyAsync.mockRejectedValue(
        new Error('Signature verification failed'),
      );

      const result = await service.validateRefreshToken(token);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });
  });

  describe('JWT utility methods', () => {
    it('should handle basic JWT service functionality', () => {
      // Test that mocked JWT service is properly configured
      expect(nestJwtService.signAsync).toBeDefined();
      expect(nestJwtService.verifyAsync).toBeDefined();
      expect(nestJwtService.decode).toBeDefined();
    });
  });
});

import { TokenType } from '../enums/token-type.enum';

export interface JwtRefreshTokenPayload {
  sub: string; // User ID
  organizationId: string;
  tokenId: string; // Refresh token ID for validation
  iat: number; // Issued at
  exp: number; // Expires at
  type: TokenType.REFRESH;
}

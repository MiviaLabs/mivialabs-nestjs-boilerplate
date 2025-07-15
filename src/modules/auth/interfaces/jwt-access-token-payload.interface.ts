import { TokenType } from '../enums/token-type.enum';

export interface JwtAccessTokenPayload {
  sub: string; // User ID
  organizationId: string;
  iat: number; // Issued at
  exp: number; // Expires at
  type: TokenType.ACCESS;
}

export interface JwtTokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  expiresIn?: number; // Access token expiry in seconds
}

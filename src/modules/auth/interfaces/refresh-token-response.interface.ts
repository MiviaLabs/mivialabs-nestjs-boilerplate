export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string; // ISO string
  refreshTokenExpiresAt: string; // ISO string
}

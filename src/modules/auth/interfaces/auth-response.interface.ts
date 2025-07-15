export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string; // ISO string
  refreshTokenExpiresAt: string; // ISO string
  user: {
    id: string;
    email: string;
    organizationId: string;
  };
}

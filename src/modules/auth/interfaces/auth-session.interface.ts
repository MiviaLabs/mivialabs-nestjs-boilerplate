import { AuthenticatedUser } from './authenticated-user.interface';
import { RefreshTokenMetadata } from './refresh-token-metadata.interface';

export interface AuthSession {
  user: AuthenticatedUser;
  tokenPair: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
    refreshTokenExpiresAt: Date;
  };
  metadata: RefreshTokenMetadata;
}

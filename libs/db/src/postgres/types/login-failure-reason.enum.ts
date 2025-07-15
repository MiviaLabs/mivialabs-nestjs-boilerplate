export enum LoginFailureReason {
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  USER_INACTIVE = 'user_inactive',
  USER_NOT_VERIFIED = 'user_not_verified',
  ORGANIZATION_INACTIVE = 'organization_inactive',
  ACCOUNT_LOCKED = 'account_locked',
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',
}

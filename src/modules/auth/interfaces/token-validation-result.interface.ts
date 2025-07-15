export interface TokenValidationResult {
  isValid: boolean;
  userId?: string;
  organizationId?: string;
  tokenId?: string;
  error?: string;
}

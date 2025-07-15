export interface OrganizationSlugValidationResult {
  isValid: boolean;
  organization?: {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
  };
  errors?: string[];
}

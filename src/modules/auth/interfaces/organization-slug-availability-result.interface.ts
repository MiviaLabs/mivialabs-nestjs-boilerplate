export interface OrganizationSlugAvailabilityResult {
  isAvailable: boolean;
  slug: string;
  isValid: boolean;
  errors?: string[];
  suggestions?: string[];
}

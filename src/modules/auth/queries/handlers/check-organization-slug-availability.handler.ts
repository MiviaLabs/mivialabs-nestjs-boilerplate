import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { organization } from '@db/postgres/schema/organization';
import { CheckOrganizationSlugAvailabilityQuery } from '../check-organization-slug-availability.query';
import { OrganizationSlugAvailabilityResult } from '../../interfaces/organization-slug-availability-result.interface';

@QueryHandler(CheckOrganizationSlugAvailabilityQuery)
@Injectable()
export class CheckOrganizationSlugAvailabilityHandler
  implements IQueryHandler<CheckOrganizationSlugAvailabilityQuery>
{
  private readonly logger = new Logger(
    CheckOrganizationSlugAvailabilityHandler.name,
  );

  constructor(@Inject('DB') private readonly db: PostgresDb) {}

  async execute(
    query: CheckOrganizationSlugAvailabilityQuery,
  ): Promise<OrganizationSlugAvailabilityResult> {
    const { slug } = query;

    try {
      // Basic slug validation
      const validationErrors = this.validateSlugFormat(slug);
      const isValid = validationErrors.length === 0;

      if (!isValid) {
        return {
          isAvailable: false,
          slug: slug.trim().toLowerCase(),
          isValid: false,
          errors: validationErrors,
        };
      }

      const normalizedSlug = slug.trim().toLowerCase();

      // Check if slug is already taken
      const existingOrganizations = await this.db
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, normalizedSlug))
        .limit(1);

      const isAvailable = existingOrganizations.length === 0;

      if (!isAvailable) {
        // Generate alternative suggestions
        const suggestions = await this.generateSlugSuggestions(normalizedSlug);

        return {
          isAvailable: false,
          slug: normalizedSlug,
          isValid: true,
          errors: ['Organization slug is already taken'],
          suggestions,
        };
      }

      this.logger.log(`Organization slug is available: ${normalizedSlug}`);

      return {
        isAvailable: true,
        slug: normalizedSlug,
        isValid: true,
      };
    } catch (error) {
      this.logger.error('Error checking organization slug availability', error);
      return {
        isAvailable: false,
        slug: slug.trim().toLowerCase(),
        isValid: false,
        errors: ['Internal server error during availability check'],
      };
    }
  }

  private validateSlugFormat(slug: string): string[] {
    const errors: string[] = [];

    // Check if slug is provided
    if (!slug || slug.trim().length === 0) {
      errors.push('Organization slug is required');
      return errors;
    }

    const trimmedSlug = slug.trim();

    // Check slug length
    if (trimmedSlug.length < 2) {
      errors.push('Organization slug must be at least 2 characters long');
    }

    if (trimmedSlug.length > 50) {
      errors.push('Organization slug must be no more than 50 characters long');
    }

    // Check slug format (alphanumeric and hyphens only, no consecutive hyphens)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!slugRegex.test(trimmedSlug.toLowerCase())) {
      errors.push(
        'Organization slug can only contain lowercase letters, numbers, and hyphens (no consecutive hyphens)',
      );
    }

    // Check if slug starts or ends with hyphen
    if (trimmedSlug.startsWith('-') || trimmedSlug.endsWith('-')) {
      errors.push('Organization slug cannot start or end with a hyphen');
    }

    // Check for reserved slugs
    const reservedSlugs = [
      'api',
      'www',
      'mail',
      'ftp',
      'admin',
      'root',
      'support',
      'help',
      'docs',
      'blog',
      'status',
      'app',
      'dashboard',
      'auth',
      'login',
      'signup',
      'register',
      'logout',
      'profile',
      'settings',
      'account',
      'billing',
      'pricing',
      'terms',
      'privacy',
      'contact',
      'about',
      'careers',
      'jobs',
      'team',
      'company',
      'enterprise',
      'business',
      'developer',
      'developers',
      'api-docs',
      'swagger',
      'health',
      'ping',
      'metrics',
      'monitoring',
      'analytics',
      'tracking',
    ];

    if (reservedSlugs.includes(trimmedSlug.toLowerCase())) {
      errors.push('This organization slug is reserved and cannot be used');
    }

    return errors;
  }

  private async generateSlugSuggestions(baseSlug: string): Promise<string[]> {
    const suggestions: string[] = [];
    const maxSuggestions = 5;

    try {
      // Generate numbered variations
      for (let i = 1; i <= maxSuggestions + 5; i++) {
        const suggestion = `${baseSlug}-${i}`;

        // Check if this suggestion is available
        const existing = await this.db
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, suggestion))
          .limit(1);

        if (existing.length === 0) {
          suggestions.push(suggestion);

          if (suggestions.length >= maxSuggestions) {
            break;
          }
        }
      }

      // If we don't have enough numbered suggestions, try with year
      if (suggestions.length < maxSuggestions) {
        const currentYear = new Date().getFullYear();
        const yearSuggestion = `${baseSlug}-${currentYear}`;

        const existing = await this.db
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.slug, yearSuggestion))
          .limit(1);

        if (existing.length === 0 && !suggestions.includes(yearSuggestion)) {
          suggestions.push(yearSuggestion);
        }
      }

      // Try with common suffixes
      if (suggestions.length < maxSuggestions) {
        const suffixes = [
          'inc',
          'llc',
          'corp',
          'ltd',
          'co',
          'team',
          'group',
          'org',
        ];

        for (const suffix of suffixes) {
          if (suggestions.length >= maxSuggestions) break;

          const suggestion = `${baseSlug}-${suffix}`;

          const existing = await this.db
            .select({ id: organization.id })
            .from(organization)
            .where(eq(organization.slug, suggestion))
            .limit(1);

          if (existing.length === 0 && !suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        }
      }

      return suggestions.slice(0, maxSuggestions);
    } catch (error) {
      this.logger.error('Error generating slug suggestions', error);
      return [];
    }
  }
}

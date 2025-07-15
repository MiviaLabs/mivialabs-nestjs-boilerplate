import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { PostgresDb } from '@db/postgres/types/postgres-db.type';
import { organization } from '@db/postgres/schema/organization';
import { ValidateOrganizationSlugQuery } from '../validate-organization-slug.query';
import { OrganizationSlugValidationResult } from '../../interfaces/organization-slug-validation-result.interface';

@QueryHandler(ValidateOrganizationSlugQuery)
@Injectable()
export class ValidateOrganizationSlugHandler
  implements IQueryHandler<ValidateOrganizationSlugQuery>
{
  private readonly logger = new Logger(ValidateOrganizationSlugHandler.name);

  constructor(@Inject('DB') private readonly db: PostgresDb) {}

  async execute(
    query: ValidateOrganizationSlugQuery,
  ): Promise<OrganizationSlugValidationResult> {
    const { slug } = query;

    try {
      // Basic slug validation
      const validationErrors = this.validateSlugFormat(slug);
      if (validationErrors.length > 0) {
        return {
          isValid: false,
          errors: validationErrors,
        };
      }

      // Check if organization exists in database
      const organizations = await this.db
        .select({
          id: organization.id,
          slug: organization.slug,
          isActive: organization.isActive,
        })
        .from(organization)
        .where(eq(organization.slug, slug.toLowerCase()))
        .limit(1);

      if (organizations.length === 0) {
        return {
          isValid: false,
          errors: ['Organization not found'],
        };
      }

      const org = organizations[0];

      // Check if organization is active
      if (!org || !org.isActive) {
        return {
          isValid: false,
          errors: ['Organization is not active'],
        };
      }

      this.logger.log(`Organization slug validation successful: ${slug}`);

      return {
        isValid: true,
        organization: {
          id: org.id,
          slug: org.slug || '',
          name: '', // Organization name not stored in schema
          isActive: org.isActive,
        },
      };
    } catch (error) {
      this.logger.error('Error validating organization slug', error);
      return {
        isValid: false,
        errors: ['Internal server error during validation'],
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
}

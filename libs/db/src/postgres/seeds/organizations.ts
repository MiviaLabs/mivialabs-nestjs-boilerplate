import { eq } from 'drizzle-orm';
import { PostgresDb } from '../types/postgres-db.type';
import { organization } from '../schema/organization';
import { user } from '../schema/user';
import { userOrganizationRole } from '../schema/user-organization-role';
import { UserRole } from '../types/user-role.enum';
import { hashPassword } from '../../../../../src/common/auth';

const defaultOrganizations = [
  {
    name: 'Default Organization',
    slug: 'default-organization',
    description: 'Default organization for the system',
    isActive: true,
  },
];

const defaultUsers = [
  {
    email: 'admin@mivialabs.com',
    password: 'Admin123!',
    isActive: true,
    isEmailVerified: true,
    isSystemAdmin: true,
    organizationName: 'Default Organization',
    role: UserRole.ORGANIZATION_OWNER,
  },
];

export async function seedOrganizations(db: PostgresDb): Promise<void> {
  console.log('🏢 Seeding organizations and users...');

  try {
    await db.transaction(async (tx) => {
      // First, seed organizations
      const createdOrgs: { [key: string]: string } = {};

      for (const orgData of defaultOrganizations) {
        // Check if organization already exists by name
        const existingOrg = await tx
          .select()
          .from(organization)
          .where(eq(organization.name, orgData.name))
          .limit(1);

        if (existingOrg.length === 0) {
          const [newOrg] = await tx
            .insert(organization)
            .values(orgData)
            .returning();
          if (newOrg) {
            createdOrgs[orgData.name] = newOrg.id;
            console.log(`✅ Created organization: ${orgData.name}`);
          }
        } else {
          const existingOrgData = existingOrg[0];
          if (existingOrgData) {
            createdOrgs[orgData.name] = existingOrgData.id;
            console.log(`⏭️  Organization already exists: ${orgData.name}`);
          }
        }
      }

      // Then, seed users
      for (const userData of defaultUsers) {
        // Check if user already exists by email
        const existingUser = await tx
          .select()
          .from(user)
          .where(eq(user.email, userData.email))
          .limit(1);

        if (existingUser.length === 0) {
          const organizationId = createdOrgs[userData.organizationName];
          if (!organizationId) {
            console.error(
              `❌ Organization not found: ${userData.organizationName}`,
            );
            continue;
          }

          // Hash the password
          const passwordHash: string = await hashPassword(userData.password);

          // Create user
          const newUsers = await tx
            .insert(user)
            .values({
              email: userData.email,
              passwordHash,
              isActive: userData.isActive,
              isEmailVerified: userData.isEmailVerified,
              isSystemAdmin: userData.isSystemAdmin,
              organizationId,
            })
            .returning();
          const newUser = newUsers[0];

          // Create user organization role
          if (newUser) {
            await tx.insert(userOrganizationRole).values({
              userId: newUser.id,
              organizationId,
              role: userData.role,
            });
          }

          console.log(
            `✅ Created user: ${userData.email} with role ${userData.role}`,
          );
        } else {
          console.log(`⏭️  User already exists: ${userData.email}`);
        }
      }
    });

    console.log('🎉 Organization and user seeding completed!');
  } catch (error) {
    console.error('❌ Organization and user seeding failed:', error);
    throw error;
  }
}

import { eq } from 'drizzle-orm';
import { PostgresDb } from '../types/postgres-db.type';
import { organization } from '../schema/organization';
import { systemAdminTx } from '../rls-tx';

const defaultOrganizations = [
  {
    name: 'Default Organization',
    description: 'Default organization for the system',
    isActive: true,
  },
];

export async function seedOrganizations(db: PostgresDb): Promise<void> {
  console.log('🏢 Seeding organizations...');

  try {
    await systemAdminTx(db, async (tx) => {
      for (const orgData of defaultOrganizations) {
        // Check if organization already exists by name
        const existingOrg = await tx
          .select()
          .from(organization)
          .where(eq(organization.name, orgData.name))
          .limit(1);

        if (existingOrg.length === 0) {
          await tx.insert(organization).values(orgData);
          console.log(`✅ Created organization: ${orgData.name}`);
        } else {
          console.log(`⏭️  Organization already exists: ${orgData.name}`);
        }
      }
    });

    console.log('🎉 Organization seeding completed!');
  } catch (error) {
    console.error('❌ Organization seeding failed:', error);
    throw error;
  }
}

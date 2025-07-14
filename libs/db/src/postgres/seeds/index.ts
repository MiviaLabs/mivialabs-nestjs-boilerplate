import { PostgresDb } from '../types/postgres-db.type';

// Organization seeds
import { seedOrganizations } from './organizations';

export async function seedDatabase(db: PostgresDb): Promise<void> {
  console.log('🌱 Starting database seeding...');

  try {
    // Seed organizations first (other entities may reference organizations)
    await seedOrganizations(db);

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Export individual seed functions for selective seeding
export { seedOrganizations };

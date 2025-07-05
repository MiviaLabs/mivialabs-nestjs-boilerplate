import { PostgresDb } from '../types';

// Prompt seeds
// import { seedPromptCategories } from './prompts-categories';

// // Agent seeds
// import { seedProcessUrlAgent } from './agents/process-url';

// // Tool seeds
// import { seedDocumentProcessingTools } from './tools/document-processing-tools';

export async function seedDatabase(db: PostgresDb) {
  console.log('🌱 Starting database seeding...');

  try {
    // Seed prompt categories first (prompts may reference categories)
    // await seedPromptCategories(db);

    // // Seed tools (agents may reference tools)
    // await seedDocumentProcessingTools(db);

    // // Seed agents
    // await seedProcessUrlAgent(db);

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Export individual seed functions for selective seeding
// export { seedPromptCategories, seedProcessUrlAgent, seedDocumentProcessingTools };

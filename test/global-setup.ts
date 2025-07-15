import { TestContainerFactory } from './setup/test-container-factory';

export default async function globalSetup() {
  console.log('🚀 Global test setup - Starting testcontainers...');

  try {
    await TestContainerFactory.setupAll();
    console.log('✅ Global test setup completed');
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

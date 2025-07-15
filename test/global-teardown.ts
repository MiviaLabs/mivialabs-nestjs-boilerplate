import { TestContainerFactory } from './setup/test-container-factory';

export default async function globalTeardown() {
  console.log('🧹 Global test teardown - Stopping testcontainers...');

  try {
    await TestContainerFactory.teardownAll();
    console.log('✅ Global test teardown completed');
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw to avoid masking test results
  }
}

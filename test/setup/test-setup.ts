import { TestContainerFactory } from './test-container-factory';

beforeAll(() => {
  // Ensure containers are running
  if (!TestContainerFactory.isReady()) {
    throw new Error(
      'Test containers are not ready. Global setup may have failed.',
    );
  }

  console.log('✅ Test environment verified for test suite');
});

beforeEach(async () => {
  // Add delay between tests to avoid potential resource conflicts
  await new Promise((resolve) => setTimeout(resolve, 100));
});

afterAll(() => {
  // Individual test cleanup if needed
  console.log('🧹 Test suite cleanup completed');
});

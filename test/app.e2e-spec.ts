import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelpers } from './utils/test-helpers';
import { TestContainerFactory } from './setup/test-container-factory';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Ensure test containers are ready
    if (!TestContainerFactory.isReady()) {
      await TestContainerFactory.setupAll();
    }

    app = await TestHelpers.createTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return 404 for undefined routes', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });

  it('should serve API documentation at /docs', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
  });
});

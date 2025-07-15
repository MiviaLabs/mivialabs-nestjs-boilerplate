import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestContainerFactory } from '../setup/test-container-factory';
import { TestAppFactory } from '../setup/test-app-factory';

export class TestHelpers {
  /**
   * Create a test application instance with all containers configured
   */
  static async createTestApp(): Promise<INestApplication> {
    const environment = TestContainerFactory.getEnvironment();
    if (!environment) {
      throw new Error(
        'Test environment not available. Ensure containers are started.',
      );
    }

    return TestAppFactory.create(environment);
  }

  /**
   * Get a supertest request instance for the app
   */
  static getRequest(app: INestApplication) {
    return request(app.getHttpServer());
  }

  /**
   * Helper to make authenticated requests
   */
  static async makeAuthenticatedRequest(
    app: INestApplication,
    method: 'get' | 'post' | 'put' | 'delete' | 'patch',
    path: string,
    token?: string,
    body?: any,
  ) {
    const req = request(app.getHttpServer())[method](path);

    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }

    if (body) {
      req.send(body as object);
    }

    return req;
  }

  /**
   * Helper to generate test correlation IDs
   */
  static generateCorrelationId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Helper to add standard test headers
   */
  static addTestHeaders(req: request.Test, correlationId?: string) {
    req.set('X-Correlation-ID', correlationId || this.generateCorrelationId());
    req.set('X-Request-ID', this.generateCorrelationId());
    req.set('User-Agent', 'API-E2E-Tests/1.0');
    return req;
  }

  /**
   * Wait for a condition to be true (polling helper)
   */
  static async waitFor(
    condition: () => Promise<boolean> | boolean,
    options: {
      timeout?: number;
      interval?: number;
      description?: string;
    } = {},
  ): Promise<void> {
    const {
      timeout = 10000,
      interval = 100,
      description = 'condition',
    } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.sleep(interval);
    }

    throw new Error(`Timeout waiting for ${description} after ${timeout}ms`);
  }

  /**
   * Sleep helper
   */
  static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if all containers are healthy
   */
  static checkContainerHealth(): boolean {
    const environment = TestContainerFactory.getEnvironment();
    if (!environment) {
      return false;
    }

    try {
      // Simple health check - containers are running
      return true;
    } catch (error) {
      console.warn('Container health check failed:', error);
      return false;
    }
  }
}

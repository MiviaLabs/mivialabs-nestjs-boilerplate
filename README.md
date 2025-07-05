# HirePanel API

A modern, enterprise-grade hiring management system built with NestJS, designed to streamline recruitment processes for organizations of all sizes.

## Overview

HirePanel API is a robust backend service that provides comprehensive hiring management capabilities, including candidate tracking, interview scheduling, and organizational management. Built with modern technologies and following enterprise best practices, it offers scalability, security, and maintainability for complex recruitment workflows.

## Features

- **Organization Management**: Multi-tenant architecture supporting multiple organizations
- **Database Management**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Message Queue**: RabbitMQ integration for asynchronous task processing
- **Caching**: Redis for high-performance data caching
- **Job Queue**: BullMQ for background job processing
- **Authentication**: Secure password hashing with Argon2
- **API Documentation**: OpenAPI/Swagger integration
- **CQRS Pattern**: Command Query Responsibility Segregation for scalable architecture
- **Validation**: Comprehensive input validation with class-validator and Zod
- **Testing**: Full test suite with Jest for unit and e2e tests

## Technology Stack

### Core Framework
- **NestJS**: Enterprise-grade Node.js framework
- **TypeScript**: Type-safe JavaScript development
- **Express**: Web application framework

### Database & ORM
- **PostgreSQL**: Primary database with pgvector extension
- **Drizzle ORM**: Type-safe database toolkit
- **Drizzle Kit**: Database migration and management

### Message Brokers & Queues
- **RabbitMQ**: Message broker for inter-service communication
- **BullMQ**: Redis-based queue for background jobs
- **Redis**: In-memory data store for caching and sessions

### Security & Validation
- **Argon2**: Password hashing
- **Class Validator**: DTO validation
- **Zod**: Schema validation
- **AJV**: JSON schema validation

### Development Tools
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **SWC**: Fast TypeScript/JavaScript compiler

## Project Structure

```
hirepanel-api/
├── src/                          # Application source code
│   ├── app.module.ts            # Main application module
│   ├── app.controller.ts        # Main application controller
│   ├── app.service.ts           # Main application service
│   └── main.ts                  # Application entry point
├── libs/                        # Shared libraries
│   └── db/                      # Database library
│       └── src/
│           └── postgres/        # PostgreSQL configurations
│               ├── schema/      # Database schemas
│               ├── migrations/  # Database migrations
│               └── seeds/       # Database seed data
├── docker/                      # Docker configurations
│   ├── rabbitmq/               # RabbitMQ setup
│   └── vault/                  # HashiCorp Vault setup
├── test/                       # Test files
└── docker-compose.yml          # Multi-service Docker setup
```

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 16+
- Redis 7+
- RabbitMQ 3.13+

## Quick Start

### 1. Environment Setup

```bash
# Clone the repository
git clone <repository-url>
cd hirepanel-api

# Install dependencies
npm install
```

### 2. Database Setup

```bash
# Start services with Docker Compose
docker-compose up -d

# Run database migrations
npm run db:migration:run

# Seed the database (optional)
npm run db:seed
```

### 3. Development

```bash
# Start in development mode
npm run start:dev

# Or start in debug mode
npm run start:debug
```

The API will be available at `http://localhost:3000`

## Available Scripts

### Development
- `npm run start:dev` - Start in development mode with hot reload
- `npm run start:debug` - Start in debug mode
- `npm run start:prod` - Start in production mode

### Database Operations
- `npm run db:studio` - Open Drizzle Studio for database management
- `npm run db:migration:generate` - Generate new migration
- `npm run db:migration:run` - Run pending migrations
- `npm run db:seed` - Seed database with initial data

### Code Quality
- `npm run lint` - Run ESLint and TypeScript checks
- `npm run lint:eslint` - Run ESLint only
- `npm run lint:types` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

### Testing
- `npm run test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests

### Build
- `npm run build` - Build the application for production

## Services

### Core Services
- **API Server**: Main NestJS application (Port 3000)
- **PostgreSQL**: Database server (Port 5433)
- **Redis**: Cache and session store (Port 6379)
- **RabbitMQ**: Message broker (Port 5672, Management UI: 15672)
- **MinIO**: Object storage (Port 9000, Console: 9001)

### Service URLs
- API Documentation: `http://localhost:3000/api/docs`
- RabbitMQ Management: `http://localhost:15672`
- MinIO Console: `http://localhost:9001`
- Drizzle Studio: `npm run db:studio`

## Architecture

The application follows enterprise architecture patterns:

- **CQRS**: Separates read and write operations for better scalability
- **Multi-tenant**: Supports multiple organizations with data isolation
- **Microservices Ready**: Designed for easy service decomposition
- **Event-Driven**: Uses message queues for asynchronous processing
- **Type-Safe**: Full TypeScript coverage with strict type checking

## Development Guidelines

This project follows strict development conventions outlined in `CLAUDE.md`:

- **TypeScript**: Explicit typing required for all functions and variables
- **File Organization**: Separate files for entities, interfaces, enums, and types
- **Commit Messages**: Conventional commits with type, scope, and description
- **Code Style**: ESLint and Prettier configurations enforced
- **Security**: Secure authentication, input validation, and error handling

## Contributing

1. Follow the development rules in `CLAUDE.md`
2. Run tests before submitting: `npm run test`
3. Ensure code quality: `npm run lint`
4. Use conventional commit messages
5. Include appropriate tests for new features

## License

This project is licensed under the UNLICENSED license - see the package.json file for details.

## Support

For questions and support, please refer to the project documentation or contact the development team.
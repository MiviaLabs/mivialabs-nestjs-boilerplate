# API Development Rules

## Git Commit Conventions

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvements
- **test**: Adding or modifying tests
- **build**: Changes to build system or dependencies
- **ci**: Changes to CI configuration
- **chore**: Other changes that don't modify src or test files

### Scope

Use module/feature names: `auth`, `user`, `job`, `interview`, `notification`, etc.

### Examples

```
feat(auth): add JWT refresh token mechanism
fix(user): resolve profile update validation error
docs(api): update OpenAPI specification
refactor(interview): extract scheduling logic to separate service
```

## TypeScript Best Practices

### Type Requirements

- **ALWAYS** provide explicit types for:
  - Function parameters
  - Function return types
  - Class properties
  - Interface properties
  - Variable declarations when type cannot be inferred

### Type Examples

```typescript
// Good
function createUser(userData: CreateUserDto): Promise<User> {
  return this.userService.create(userData);
}

// Bad
function createUser(userData) {
  return this.userService.create(userData);
}
```

### General Rules

- Use `interface` for object shapes
- Use `type` for unions, intersections, and computed types
- Prefer `unknown` over `any`
- Use strict null checks
- Enable `noImplicitAny` and `strictNullChecks`

## File Organization

### Separate Files Rule

Each of the following MUST be in separate files:

- Classes
- Interfaces
- Enums
- Types
- Constants

### File Naming Conventions

```
user.entity.ts          // Classes
user.interface.ts       // Interfaces
user-status.enum.ts     // Enums
user.types.ts          // Type definitions
user.constants.ts      // Constants
```

### Directory Structure

```
src/
├── modules/
│   ├── user/
│   │   ├── entities/
│   │   │   └── user.entity.ts
│   │   ├── interfaces/
│   │   │   ├── user.interface.ts
│   │   │   └── user-repository.interface.ts
│   │   ├── enums/
│   │   │   └── user-status.enum.ts
│   │   ├── types/
│   │   │   └── user.types.ts
│   │   ├── dto/
│   │   ├── services/
│   │   └── controllers/
```

## NestJS Best Practices

### Module Organization

- One feature per module
- Use barrel exports (index.ts)
- Keep modules focused and cohesive
- Use dependency injection consistently

### Controller Rules

- Keep controllers thin
- Delegate business logic to services
- Use proper HTTP status codes
- Implement proper error handling
- Use DTOs for request/response validation

### Service Rules

- Single responsibility principle
- Use dependency injection
- Make services testable
- Handle errors gracefully
- Use proper logging levels

### Example Structure

```typescript
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.create(createUserDto);
  }
}
```

## Distributed System & Multi-Replica Rules

### Database Considerations

- Use database transactions for consistency
- Implement proper connection pooling
- Use read replicas for read-heavy operations
- Handle connection timeouts gracefully

### Caching Strategy

- Use Redis for distributed caching
- Implement cache invalidation strategies
- Use proper cache keys with prefixes
- Handle cache failures gracefully

### Session Management

- Use stateless authentication (JWT)
- Store sessions in Redis for multi-replica support
- Implement proper session cleanup
- Use secure session configuration

### Health Checks

- Implement `/health` endpoint
- Check database connectivity
- Check external service dependencies
- Use proper health check timeouts

### Configuration

- Use environment variables for configuration
- Implement configuration validation
- Use different configs for different environments
- Never hardcode sensitive values

## CQRS Pattern Rules

### Command Structure

```typescript
// commands/create-user.command.ts
export class CreateUserCommand {
  constructor(
    public readonly userData: CreateUserDto,
    public readonly requesterId: string,
  ) {}
}
```

### Query Structure

```typescript
// queries/get-user.query.ts
export class GetUserQuery {
  constructor(public readonly userId: string) {}
}
```

### Handler Rules

- One handler per command/query
- Implement proper error handling
- Use dependency injection
- Keep handlers focused
- Implement proper logging

### Event Sourcing (if applicable)

- Use immutable events
- Implement proper event versioning
- Handle event replay scenarios
- Use proper event store

## Security Rules

### Authentication & Authorization

- Use JWT tokens with proper expiration
- Implement refresh token mechanism
- Use proper password hashing (bcrypt)
- Implement role-based access control (RBAC)

### Input Validation

- Validate all inputs using class-validator
- Sanitize user inputs
- Use proper DTO validation
- Implement rate limiting

### Security Headers

- Use helmet.js for security headers
- Implement CORS properly
- Use HTTPS in production
- Implement proper CSP headers

### Sensitive Data

- Never log sensitive information
- Use environment variables for secrets
- Implement proper secret rotation
- Use secure random generators

### Database Security

- Use parameterized queries
- Implement proper database permissions
- Use connection encryption
- Regular security audits

### Example Security Implementation

```typescript
@Post('login')
@UseGuards(ThrottlerGuard)
@Throttle(5, 60) // 5 attempts per minute
async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
  // Implementation
}
```

## Error Handling

### HTTP Exceptions

- Use NestJS built-in exceptions
- Implement custom exception filters
- Provide meaningful error messages
- Use proper HTTP status codes

### Logging

- Use structured logging
- Implement proper log levels
- Include correlation IDs
- Never log sensitive data

### Monitoring

- Implement application metrics
- Use health checks
- Monitor database performance
- Set up proper alerting

## Testing Rules

### Unit Tests

- Test all service methods
- Use mocking for dependencies
- Test error scenarios
- Maintain high test coverage

### Integration Tests

- Test API endpoints
- Test database interactions
- Test external service integrations
- Use test databases

### E2E Tests

- Test complete user flows
- Test authentication flows
- Test error scenarios
- Use proper test data setup

## Performance Rules

### Database

- Use proper indexing
- Implement query optimization
- Use connection pooling
- Monitor slow queries

### Caching

- Cache frequently accessed data
- Use proper cache invalidation
- Monitor cache hit rates
- Implement cache warming

### API Performance

- Implement pagination
- Use compression
- Optimize payload sizes
- Monitor response times

## Documentation Rules

### API Documentation

- Use OpenAPI/Swagger
- Document all endpoints
- Include request/response examples
- Keep documentation up-to-date

### Code Documentation

- Document complex business logic
- Use JSDoc for public APIs
- Include usage examples
- Document configuration options

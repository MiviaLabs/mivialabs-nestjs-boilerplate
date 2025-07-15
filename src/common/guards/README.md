# Authentication Guards

## Updated Guards for New Database Schema

The guards have been updated to work with the new user database schema and role system.

### Available Guards

1. **JwtAuthGuard** - Basic JWT authentication
   - Validates JWT tokens
   - Sets RLS context with organization and user role
   - Populates `request.user` with authenticated user data

2. **SystemAdminGuard** - System administrator access
   - Requires `UserRole.SYSTEM_ADMIN`
   - Use for system-level operations

3. **RolesGuard** - Flexible role-based access
   - Use with `@Roles(UserRole.ORGANIZATION_OWNER, UserRole.ORGANIZATION_MEMBER)` decorator
   - System admins always have access
   - Replaces the need for specific organization guards

### Usage Examples

```typescript
// Basic authentication
@UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@Req() req: RequestWithUser) {
  return req.user;
}

// System admin only
@UseGuards(JwtAuthGuard, SystemAdminGuard)
@Post('admin/settings')
async updateSystemSettings() {
  // Only system admins can access
}

// Organization owner only
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZATION_OWNER)
@Put('organization/settings')
async updateOrgSettings() {
  // Only organization owners can access
}

// Any organization member
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZATION_OWNER, UserRole.ORGANIZATION_MEMBER)
@Get('organization/data')
async getOrgData() {
  // Any organization member can access
}

// Multiple roles with one decorator
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ORGANIZATION_OWNER)
@Delete('organization/user/:id')
async removeUser() {
  // Only organization owners can access
}
```

### AuthenticatedUser Interface

```typescript
interface AuthenticatedUser {
  id: string;
  organizationId: string | null;
  email: string;
  isSystemAdmin: boolean;
  isActive: boolean;
  isEmailVerified: boolean;
  role?: UserRole;
}
```

### Test File Updates Needed

The `jwt-auth.guard.spec.ts` file needs to be updated to match the new interface:
- Remove `name`, `lastName`, `phone` properties
- Add `isSystemAdmin`, `isActive`, `isEmailVerified` properties
- Update role to use `UserRole` enum
- Update database mock to return new user schema format

## RLS Context

The JWT guard automatically sets the following RLS context variables:
- `app.current_organization_id` - User's organization ID
- `app.current_user_id` - User's ID
- `app.current_user_role` - User's role in the organization

This enables the database RLS policies to work correctly for multi-tenant security.
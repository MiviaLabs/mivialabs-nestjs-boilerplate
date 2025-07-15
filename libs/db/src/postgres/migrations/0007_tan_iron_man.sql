DROP POLICY "event_insert_system_only" ON "event" CASCADE;--> statement-breakpoint
DROP POLICY "event_select_system" ON "event" CASCADE;--> statement-breakpoint
CREATE POLICY "event_system_full_access" ON "event" AS PERMISSIVE FOR ALL TO "system" USING (true) WITH CHECK (true);

-- Event table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON event TO system;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON event TO system_admin;--> statement-breakpoint
GRANT SELECT ON event TO authenticated;--> statement-breakpoint

-- User table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON "user" TO system;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "user" TO system_admin;--> statement-breakpoint
GRANT SELECT, UPDATE ON "user" TO authenticated;--> statement-breakpoint

-- Organization table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON organization TO system;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON organization TO system_admin;--> statement-breakpoint
GRANT SELECT, UPDATE ON organization TO authenticated;--> statement-breakpoint

-- User organization role table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON user_organization_role TO system;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON user_organization_role TO system_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON user_organization_role TO authenticated;--> statement-breakpoint

-- Refresh token table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_token TO system;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_token TO system_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_token TO authenticated;--> statement-breakpoint

-- File table grants
GRANT SELECT, INSERT, UPDATE, DELETE ON file TO system_admin;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON file TO authenticated;--> statement-breakpoint
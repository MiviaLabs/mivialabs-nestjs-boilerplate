CREATE TABLE "refresh_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"user_agent" text,
	"ip_address" text,
	"is_revoked" timestamp with time zone,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "refresh_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "refresh_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "refresh_token_user_id_idx" ON "refresh_token" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_token_organization_id_idx" ON "refresh_token" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "refresh_token_expires_at_idx" ON "refresh_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "refresh_token_token_hash_idx" ON "refresh_token" USING btree ("token_hash");--> statement-breakpoint
CREATE POLICY "refresh_token_select_organization" ON "refresh_token" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("refresh_token"."organization_id" = current_setting('app.current_organization_id')::uuid AND "refresh_token"."user_id" = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "refresh_token_insert_organization" ON "refresh_token" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("refresh_token"."organization_id" = current_setting('app.current_organization_id')::uuid AND "refresh_token"."user_id" = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "refresh_token_update_organization" ON "refresh_token" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("refresh_token"."organization_id" = current_setting('app.current_organization_id')::uuid AND "refresh_token"."user_id" = current_setting('app.current_user_id')::uuid) WITH CHECK ("refresh_token"."organization_id" = current_setting('app.current_organization_id')::uuid AND "refresh_token"."user_id" = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "refresh_token_delete_organization" ON "refresh_token" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("refresh_token"."organization_id" = current_setting('app.current_organization_id')::uuid AND "refresh_token"."user_id" = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "refresh_token_system_admin_full_access" ON "refresh_token" AS PERMISSIVE FOR ALL TO "system_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "refresh_token_system_auth_access" ON "refresh_token" AS PERMISSIVE FOR SELECT TO "system" USING (true);
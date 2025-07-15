CREATE TYPE "public"."user_role" AS ENUM('system_admin', 'organization_owner', 'organization_member');--> statement-breakpoint
CREATE ROLE "authenticated";--> statement-breakpoint
CREATE ROLE "system_admin";--> statement-breakpoint
CREATE ROLE "system";--> statement-breakpoint
-- GRANT system TO postgres;
-- GRANT authenticated TO postgres;
-- GRANT system_admin TO postgres;

CREATE TABLE "event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"event_version" text DEFAULT '1.0' NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_version" integer DEFAULT 1 NOT NULL,
	"event_data" jsonb NOT NULL,
	"metadata" jsonb,
	"sequence_number" integer NOT NULL,
	"causation_id" uuid,
	"correlation_id" uuid,
	"organization_id" uuid,
	"user_id" uuid,
	"session_id" text,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"email" text NOT NULL,
	"password_hash" text DEFAULT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_system_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_organization_role" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	CONSTRAINT "user_organization_role_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "user_organization_role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_role" ADD CONSTRAINT "user_organization_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_organization_role" ADD CONSTRAINT "user_organization_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_aggregate_sequence_unique" ON "event" USING btree ("aggregate_id","sequence_number");--> statement-breakpoint
CREATE INDEX "event_aggregate_id_idx" ON "event" USING btree ("aggregate_id");--> statement-breakpoint
CREATE INDEX "event_type_idx" ON "event" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "event_aggregate_type_idx" ON "event" USING btree ("aggregate_type");--> statement-breakpoint
CREATE INDEX "event_correlation_id_idx" ON "event" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "event_created_at_idx" ON "event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "event_organization_id_idx" ON "event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_aggregate_events_idx" ON "event" USING btree ("aggregate_id","aggregate_type","sequence_number");--> statement-breakpoint
CREATE INDEX "event_type_time_idx" ON "event" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE POLICY "event_select_organization" ON "event" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event"."organization_id" IS NULL OR "event"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "event_insert_system_only" ON "event" AS PERMISSIVE FOR INSERT TO "system" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "event_system_admin_full_access" ON "event" AS PERMISSIVE FOR ALL TO "system_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "organization_select_authenticated" ON "organization" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "organization_update_owner_only" ON "organization" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (current_setting('app.current_user_role', true) = 'organization_owner') WITH CHECK (current_setting('app.current_user_role', true) = 'organization_owner');--> statement-breakpoint
CREATE POLICY "organization_system_admin_full_access" ON "organization" AS PERMISSIVE FOR ALL TO "system_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_select_organization" ON "user" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "user_update_self" ON "user" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user"."id" = current_setting('app.current_user_id')::uuid) WITH CHECK ("user"."id" = current_setting('app.current_user_id')::uuid);--> statement-breakpoint
CREATE POLICY "user_insert_system_only" ON "user" AS PERMISSIVE FOR INSERT TO "system" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_system_admin_full_access" ON "user" AS PERMISSIVE FOR ALL TO "system_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_org_role_select_organization" ON "user_organization_role" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_organization_role"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "user_org_role_manage_owner_only" ON "user_organization_role" AS PERMISSIVE FOR ALL TO "authenticated" USING ("user_organization_role"."organization_id" = current_setting('app.current_organization_id')::uuid AND current_setting('app.current_user_role', true) = 'organization_owner') WITH CHECK ("user_organization_role"."organization_id" = current_setting('app.current_organization_id')::uuid AND current_setting('app.current_user_role', true) = 'organization_owner');--> statement-breakpoint
CREATE POLICY "user_org_role_system_full_access" ON "user_organization_role" AS PERMISSIVE FOR ALL TO "system" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_org_role_system_admin_full_access" ON "user_organization_role" AS PERMISSIVE FOR ALL TO "system_admin" USING (true) WITH CHECK (true);
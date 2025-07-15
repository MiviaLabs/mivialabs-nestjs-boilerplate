CREATE TABLE "file" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"checksum" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid DEFAULT NULL,
	"created_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_organization_id_idx" ON "file" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "file_bucket_idx" ON "file" USING btree ("bucket");--> statement-breakpoint
CREATE INDEX "file_mime_type_idx" ON "file" USING btree ("mime_type");--> statement-breakpoint
CREATE INDEX "file_created_at_idx" ON "file" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "file_uploaded_by_idx" ON "file" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "file_public_idx" ON "file" USING btree ("is_public");--> statement-breakpoint
CREATE UNIQUE INDEX "file_organization_bucket_path_unique" ON "file" USING btree ("organization_id","bucket","path");--> statement-breakpoint
CREATE POLICY "file_select_organization" ON "file" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("file"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_insert_organization" ON "file" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("file"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_update_organization" ON "file" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("file"."organization_id" = current_setting('app.current_organization_id')::uuid) WITH CHECK ("file"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_delete_organization" ON "file" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("file"."organization_id" = current_setting('app.current_organization_id')::uuid);--> statement-breakpoint
CREATE POLICY "file_select_public" ON "file" AS PERMISSIVE FOR SELECT TO public USING ("file"."is_public" = true);--> statement-breakpoint
CREATE POLICY "file_system_admin_full_access" ON "file" AS PERMISSIVE FOR ALL TO "system_admin" USING (true) WITH CHECK (true);
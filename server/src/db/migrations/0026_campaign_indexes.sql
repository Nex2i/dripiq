CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_contact_campaign_instance_id" ON "dripiq_app"."campaign_step_instances" USING btree ("contact_campaign_instance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_campaign_step_template_id" ON "dripiq_app"."campaign_step_instances" USING btree ("campaign_step_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_tenant_id" ON "dripiq_app"."campaign_step_instances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_status" ON "dripiq_app"."campaign_step_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_scheduled_at" ON "dripiq_app"."campaign_step_instances" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_instances_channel" ON "dripiq_app"."campaign_step_instances" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_templates_campaign_template_id" ON "dripiq_app"."campaign_step_templates" USING btree ("campaign_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_templates_tenant_id" ON "dripiq_app"."campaign_step_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_campaign_step_templates_channel" ON "dripiq_app"."campaign_step_templates" USING btree ("channel");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_contact_id" ON "dripiq_app"."contact_campaign_instances" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_campaign_template_id" ON "dripiq_app"."contact_campaign_instances" USING btree ("campaign_template_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_tenant_id" ON "dripiq_app"."contact_campaign_instances" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contact_campaign_instances_status" ON "dripiq_app"."contact_campaign_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_step_events_campaign_step_instance_id" ON "dripiq_app"."step_events" USING btree ("campaign_step_instance_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_step_events_tenant_id" ON "dripiq_app"."step_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_step_events_event_type" ON "dripiq_app"."step_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_step_events_occurred_at" ON "dripiq_app"."step_events" USING btree ("occurred_at");
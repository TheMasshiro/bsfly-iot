CREATE TYPE "public"."control_mode" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TABLE "actuator_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"actuator" text NOT NULL,
	"drawer" text,
	"parameter" text,
	"value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actuator_states" (
	"device_id" text NOT NULL,
	"actuator" text NOT NULL,
	"state" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "actuator_states_device_id_actuator_pk" PRIMARY KEY("device_id","actuator")
);
--> statement-breakpoint
CREATE TABLE "device_members" (
	"device_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_members_device_id_user_id_pk" PRIMARY KEY("device_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"mac_address" text NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"control_mode" "control_mode" DEFAULT 'auto' NOT NULL,
	"last_seen" timestamp with time zone,
	"ip_address" text,
	"join_code" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"api_key_hint" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_mac_address_unique" UNIQUE("mac_address"),
	CONSTRAINT "devices_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "drawers" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "drawers_device_name_unique" UNIQUE("device_id","name")
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"drawer_id" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"temperature" real,
	"humidity" real,
	"moisture" real,
	"left_substrate" real,
	"center_substrate" real,
	"right_substrate" real,
	"ammonia" real
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "actuator_events" ADD CONSTRAINT "actuator_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actuator_states" ADD CONSTRAINT "actuator_states_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_members" ADD CONSTRAINT "device_members_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_members" ADD CONSTRAINT "device_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawers" ADD CONSTRAINT "drawers_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_drawer_id_drawers_id_fk" FOREIGN KEY ("drawer_id") REFERENCES "public"."drawers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actuator_events_device_time_idx" ON "actuator_events" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "device_members_user_idx" ON "device_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "readings_drawer_time_idx" ON "readings" USING btree ("drawer_id","recorded_at");
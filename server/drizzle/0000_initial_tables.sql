CREATE TYPE "public"."case_type" AS ENUM('long_case', 'short_case', 'case_based_discussion', 'procedure', 'counseling', 'other');--> statement-breakpoint
CREATE TYPE "public"."learner_level" AS ENUM('medical_student', 'house_officer', 'resident');--> statement-breakpoint
CREATE TYPE "public"."learner_year" AS ENUM('1st', '2nd', '3rd', '4th', 'final');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_counter" (
	"id" smallint PRIMARY KEY NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "change_counter_single_row" CHECK ("change_counter"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"username_lower" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pearls" (
	"id" uuid PRIMARY KEY NOT NULL,
	"doctor_id" uuid NOT NULL,
	"diagnosis" text NOT NULL,
	"points" jsonb NOT NULL,
	"times_used" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_ops" (
	"op_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_steps" (
	"session_id" uuid NOT NULL,
	"step" smallint NOT NULL,
	"seconds" integer NOT NULL,
	"rating" smallint,
	"content" jsonb NOT NULL,
	CONSTRAINT "session_steps_session_id_step_pk" PRIMARY KEY("session_id","step"),
	CONSTRAINT "session_steps_step_range" CHECK ("session_steps"."step" between 1 and 5),
	CONSTRAINT "session_steps_seconds_not_negative" CHECK ("session_steps"."seconds" >= 0),
	CONSTRAINT "session_steps_rating_range" CHECK ("session_steps"."rating" is null or "session_steps"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "student_aliases" (
	"alias_id" uuid PRIMARY KEY NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_seq" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pmdc_number" text,
	"level" "learner_level" NOT NULL,
	"year" "learner_year",
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_seq" bigint NOT NULL,
	CONSTRAINT "students_year_only_for_medical_students" CHECK ("students"."year" is null or "students"."level" = 'medical_student')
);
--> statement-breakpoint
CREATE TABLE "teaching_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"doctor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"department" text NOT NULL,
	"case_type" "case_type" NOT NULL,
	"learner_level" "learner_level" NOT NULL,
	"learner_year" "learner_year",
	"started_at" timestamp with time zone NOT NULL,
	"teaching_seconds" integer NOT NULL,
	"overtime_seconds" integer NOT NULL,
	"paused_seconds" integer NOT NULL,
	"log_seconds" integer NOT NULL,
	"diagnosis" text,
	"learner_gave_diagnosis" boolean,
	"usefulness" smallint,
	"app_version" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"change_seq" bigint NOT NULL,
	CONSTRAINT "teaching_sessions_seconds_not_negative" CHECK ("teaching_sessions"."teaching_seconds" >= 0 and "teaching_sessions"."overtime_seconds" >= 0 and "teaching_sessions"."paused_seconds" >= 0 and "teaching_sessions"."log_seconds" >= 0),
	CONSTRAINT "teaching_sessions_usefulness_range" CHECK ("teaching_sessions"."usefulness" is null or "teaching_sessions"."usefulness" between 1 and 6),
	CONSTRAINT "teaching_sessions_year_only_for_medical_students" CHECK ("teaching_sessions"."learner_year" is null or "teaching_sessions"."learner_level" = 'medical_student')
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"department" text,
	"designation" text,
	"is_doctor" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_sessions" ADD CONSTRAINT "login_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pearls" ADD CONSTRAINT "pearls_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processed_ops" ADD CONSTRAINT "processed_ops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_steps" ADD CONSTRAINT "session_steps_session_id_teaching_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."teaching_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_aliases" ADD CONSTRAINT "student_aliases_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_sessions" ADD CONSTRAINT "teaching_sessions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "login_sessions_user_id_idx" ON "login_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pearls_doctor_change_seq_idx" ON "pearls" USING btree ("doctor_id","change_seq");--> statement-breakpoint
CREATE INDEX "student_aliases_change_seq_idx" ON "student_aliases" USING btree ("change_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "students_pmdc_unique" ON "students" USING btree ("pmdc_number") WHERE "students"."pmdc_number" is not null;--> statement-breakpoint
CREATE INDEX "students_change_seq_idx" ON "students" USING btree ("change_seq");--> statement-breakpoint
CREATE INDEX "teaching_sessions_doctor_started_idx" ON "teaching_sessions" USING btree ("doctor_id","started_at");--> statement-breakpoint
CREATE INDEX "teaching_sessions_student_started_idx" ON "teaching_sessions" USING btree ("student_id","started_at");--> statement-breakpoint
CREATE INDEX "teaching_sessions_change_seq_idx" ON "teaching_sessions" USING btree ("change_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree (lower("username"));
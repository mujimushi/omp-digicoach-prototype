-- Doctors and admins log in separately. An account that was both keeps only the admin role,
-- and one with neither becomes a doctor, so the check below holds for every existing row.
UPDATE "users" SET "is_doctor" = false WHERE "is_doctor" AND "is_admin";--> statement-breakpoint
UPDATE "users" SET "is_doctor" = true WHERE NOT "is_doctor" AND NOT "is_admin";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_one_role" CHECK ("users"."is_doctor" <> "users"."is_admin");

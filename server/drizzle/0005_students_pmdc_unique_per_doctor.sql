-- Each doctor keeps their own student list: a PMDC number is unique within one doctor's students.
-- Only the index changes. No student, session or other row is read, changed or deleted.
DROP INDEX "students_pmdc_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "students_creator_pmdc_unique" ON "students" USING btree ("created_by","pmdc_number") WHERE "students"."pmdc_number" is not null;

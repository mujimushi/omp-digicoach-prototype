-- Custom SQL migration file, put your code below! --
-- The single row every student, alias, session and pearl write increments inside its own transaction.
INSERT INTO "change_counter" ("id", "value") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;

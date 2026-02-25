import re

with open('prisma/migrations/20260225052034_01/migration.sql', 'r') as f:
    sql = f.read()

def rep_type(m):
    return 'DO $$ BEGIN\n    ' + m.group(0) + '\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;'
sql = re.sub(r'CREATE TYPE "[^"]+" AS ENUM \([^)]+\);', rep_type, sql)

sql = sql.replace('CREATE TABLE "', 'CREATE TABLE IF NOT EXISTS "')
sql = sql.replace('CREATE INDEX "', 'CREATE INDEX IF NOT EXISTS "')
sql = sql.replace('CREATE UNIQUE INDEX "', 'CREATE UNIQUE INDEX IF NOT EXISTS "')

def rep_fk(m):
    return 'DO $$ BEGIN\n    ' + m.group(0) + '\nEXCEPTION\n    WHEN duplicate_object THEN null;\nEND $$;'
sql = re.sub(r'ALTER TABLE "[^"]+" ADD CONSTRAINT "[^"]+" FOREIGN KEY \([^)]+\) REFERENCES "[^"]+"\([^)]+\)(?: ON DELETE [A-Z ]+)?(?: ON UPDATE [A-Z ]+)?;', rep_fk, sql)

with open('prisma/migrations/20260225052034_01/migration.sql', 'w') as f:
    f.write(sql)

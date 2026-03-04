$env:DATABASE_URL = "postgresql://postgres:REDACTED@hopper.proxy.rlwy.net:54604/railway"
npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script > diff_output.sql

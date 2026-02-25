ALTER TABLE "Branding" DROP COLUMN IF EXISTS "sucursalId" CASCADE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='Branding' AND column_name='sucursalId'
    ) THEN
        RAISE EXCEPTION 'Column sucursalId still exists!';
    END IF;
END $$;

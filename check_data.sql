DO $$
DECLARE
    br_count integer;
    s_count integer;
    dup_count integer;
BEGIN
    SELECT count(*) INTO s_count FROM "Sucursal" WHERE id = 1;
    IF s_count = 0 THEN
        RAISE EXCEPTION 'Diagnostic Error: Sucursal with id 1 does not exist!';
    END IF;

    -- The column 'sucursalId' might exist or not right now.
    -- Let's just check the total count of Branding rows.
    SELECT count(*) INTO br_count FROM "Branding";
    IF br_count > 1 THEN
        RAISE EXCEPTION 'Diagnostic Error: More than 1 row in Branding. % rows exist.', br_count;
    END IF;

END $$;

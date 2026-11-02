import { Prisma } from "@prisma/client";

export const VENTA_NUMBERING_AUTHORITY_REQUIRED =
  "VENTA_NUMBERING_AUTHORITY_REQUIRED";
const VENTA_ASSIGN_FUNCTION_BODY_MD5 = "94901a60b8ee11d2b350c50426e4a3a5";

type QueryClient = {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
  $queryRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export async function assertVentaNumberingAuthority(client: QueryClient) {
  await client.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended('t12_venta_numbering_authority', 0))
  `;
  await client.$executeRaw`LOCK TABLE public."Venta" IN ROW EXCLUSIVE MODE`;
  const rows = (await client.$queryRaw`
    SELECT
      current_setting('session_replication_role') = 'origin'
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_class counter
        JOIN pg_catalog.pg_namespace counter_ns
          ON counter_ns.oid = counter.relnamespace
        WHERE counter_ns.nspname = 'public'
          AND counter.relname = 'VentaNumerador'
          AND counter.relkind = 'r'
          AND counter.relowner = (
            SELECT relowner
            FROM pg_catalog.pg_class
            WHERE oid = 'public."Venta"'::regclass
          )
          AND (
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', attribute.attname,
                'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
                'notNull', attribute.attnotnull
              ) ORDER BY attribute.attnum
            )
            FROM pg_catalog.pg_attribute attribute
            WHERE attribute.attrelid = counter.oid
              AND attribute.attnum > 0
              AND NOT attribute.attisdropped
          ) = '[
            {"name":"sucursalId","type":"integer","notNull":true},
            {"name":"ultimoNumero","type":"integer","notNull":true}
          ]'::jsonb
          AND EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint pk
            WHERE pk.conrelid = counter.oid
              AND pk.contype = 'p'
              AND pk.convalidated
              AND NOT pk.condeferrable
              AND NOT pk.condeferred
              AND (
                SELECT jsonb_agg(attribute.attname ORDER BY key.ordinality)
                FROM unnest(pk.conkey) WITH ORDINALITY AS key(attnum, ordinality)
                JOIN pg_catalog.pg_attribute attribute
                  ON attribute.attrelid = counter.oid
                  AND attribute.attnum = key.attnum
              ) = '["sucursalId"]'::jsonb
          )
          AND EXISTS (
            SELECT 1
            FROM pg_catalog.pg_constraint check_constraint
            WHERE check_constraint.conrelid = counter.oid
              AND check_constraint.contype = 'c'
              AND check_constraint.convalidated
              AND pg_catalog.pg_get_expr(
                check_constraint.conbin,
                check_constraint.conrelid,
                true
              ) = '"ultimoNumero" >= 0'
          )
          AND (
            SELECT COUNT(*)
            FROM pg_catalog.pg_constraint constraint_definition
            WHERE constraint_definition.conrelid = counter.oid
          ) = 2
          AND NOT EXISTS (
            SELECT 1
            FROM aclexplode(
              COALESCE(
                counter.relacl,
                acldefault('r', counter.relowner)
              )
            ) acl
            WHERE acl.grantee <> counter.relowner
              AND acl.privilege_type IN (
                'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
              )
          )
          AND (
            (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname = current_user)
            OR NOT pg_has_role(current_user, counter.relowner, 'MEMBER')
          )
      )
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_trigger trg
        JOIN pg_catalog.pg_proc fn ON fn.oid = trg.tgfoid
        JOIN pg_catalog.pg_namespace fn_ns ON fn_ns.oid = fn.pronamespace
        WHERE trg.tgrelid = 'public."Venta"'::regclass
          AND trg.tgname = 't12_assign_venta_numero'
          AND NOT trg.tgisinternal
          AND trg.tgenabled IN ('O', 'A')
          AND trg.tgtype = 7
          AND trg.tgnargs = 0
          AND trg.tgattr = ''::int2vector
          AND trg.tgqual IS NULL
          AND fn_ns.nspname = 'public'
          AND fn.proname = 't12_assign_venta_numero'
          AND fn.pronargs = 0
          AND fn.prorettype = 'pg_catalog.trigger'::regtype
          AND fn.proowner = (
            SELECT relowner
            FROM pg_catalog.pg_class
            WHERE oid = 'public."Venta"'::regclass
          )
          AND fn.prolang = (
            SELECT oid FROM pg_catalog.pg_language WHERE lanname = 'plpgsql'
          )
          AND fn.provolatile = 'v'
          AND fn.proparallel = 'u'
          AND NOT fn.proleakproof
          AND NOT fn.proisstrict
          AND md5(replace(fn.prosrc, E'\r\n', E'\n')) = ${VENTA_ASSIGN_FUNCTION_BODY_MD5}
          AND fn.prosecdef
          AND fn.proconfig = ARRAY['search_path=pg_catalog, pg_temp']
          AND NOT EXISTS (
            SELECT 1
            FROM aclexplode(
              COALESCE(fn.proacl, acldefault('f', fn.proowner))
            ) acl
            WHERE acl.grantee <> fn.proowner
              AND acl.privilege_type = 'EXECUTE'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM pg_catalog.pg_trigger other_trigger
            WHERE other_trigger.tgrelid = trg.tgrelid
              AND NOT other_trigger.tgisinternal
              AND (other_trigger.tgtype & 2) = 2
              AND (other_trigger.tgtype & 4) = 4
              AND other_trigger.oid <> trg.oid
          )
      )
      AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index i
        JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
        JOIN pg_catalog.pg_am access_method ON access_method.oid = c.relam
        WHERE i.indrelid = 'public."Venta"'::regclass
          AND c.relnamespace = 'public'::regnamespace
          AND c.relname = 'Venta_sucursalId_numeroVenta_key_t12'
          AND access_method.amname = 'btree'
          AND i.indisunique
          AND i.indimmediate
          AND NOT i.indnullsnotdistinct
          AND i.indisvalid
          AND i.indisready
          AND i.indpred IS NULL
          AND i.indexprs IS NULL
          AND i.indnkeyatts = 2
          AND i.indnatts = 2
          AND (
            SELECT jsonb_agg(a.attname ORDER BY key.ordinality)
            FROM unnest(i.indkey) WITH ORDINALITY AS key(attnum, ordinality)
            JOIN pg_catalog.pg_attribute a
              ON a.attrelid = i.indrelid AND a.attnum = key.attnum
          ) = '["sucursalId", "numeroVenta"]'::jsonb
      ) AS ready
  `) as Array<{ ready?: unknown }>;
  const [authority] = rows;

  if (authority?.ready !== true) {
    throw new Error(VENTA_NUMBERING_AUTHORITY_REQUIRED);
  }

}

export async function createVentaWithAuthority<
  T extends Prisma.VentaCreateArgs,
>(
  client: Prisma.TransactionClient,
  args: Prisma.SelectSubset<T, Prisma.VentaCreateArgs>,
) {
  if (Object.hasOwn(args.data, "numeroVenta")) {
    throw new Error("numeroVenta must be omitted under database authority");
  }
  const sucursalId = "sucursalId" in args.data ? args.data.sucursalId : undefined;
  if (typeof sucursalId !== "number" || !Number.isInteger(sucursalId)) {
    throw new Error("sucursalId is required under database authority");
  }
  await assertVentaNumberingAuthority(client);
  return client.venta.create(args);
}

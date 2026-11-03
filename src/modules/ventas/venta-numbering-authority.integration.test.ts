import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Client } from "pg";
import type { Prisma } from "@prisma/client";
import { acquireT12IntegrationLease } from "@/app/api/t12-route-integration-lease";
import {
  assertVentaNumberingAuthority,
  createVentaWithAuthority,
  VENTA_NUMBERING_AUTHORITY_REQUIRED,
} from "./venta-numbering-authority";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("TEST_DATABASE_URL is required for T12 integration");
}

test("fails closed around PostgreSQL Venta authority state and DDL races", async (t) => {
  process.env.DATABASE_URL = databaseUrl;
  const { prisma } = await import("@/lib/prisma");
  const releaseLease = await acquireT12IntegrationLease(databaseUrl);
  const expectAuthorityDriftRejected = async (
    mutate: (tx: Prisma.TransactionClient) => Promise<void>,
  ) => {
    let rejection: unknown;
    try {
      await prisma.$transaction(async (tx) => {
        await mutate(tx);
        await assertVentaNumberingAuthority(tx);
        throw new Error("T12_TEST_DRIFT_WAS_ACCEPTED");
      });
    } catch (error) {
      rejection = error;
    }
    assert.match(String(rejection), new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED));
  };
  let triggerDisabled = false;
  const runtimeRole = `t12_writer_runtime_${randomUUID().slice(0, 8)}`;
  let runtimeRoleCreated = false;
  let fixture: { sucursalId: number; clienteId: number } | null = null;
  let counterGrantDrifted = false;
  let functionConfigDrifted = false;

  t.after(async () => {
    const failures: unknown[] = [];
    if (triggerDisabled) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE public."Venta" ENABLE TRIGGER "t12_assign_venta_numero"`,
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (functionConfigDrifted) {
      try {
        await prisma.$executeRawUnsafe(
          `ALTER FUNCTION public.t12_assign_venta_numero() RESET work_mem`,
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (counterGrantDrifted) {
      try {
        await prisma.$executeRawUnsafe(
          `REVOKE SELECT ON public."VentaNumerador" FROM "${runtimeRole}"`,
        );
      } catch (error) {
        failures.push(error);
      }
    }
    if (fixture) {
      try {
        await prisma.venta.deleteMany({ where: { clienteId: fixture.clienteId } });
        await prisma.ventaNumerador.deleteMany({
          where: { sucursalId: fixture.sucursalId },
        });
        await prisma.cliente.delete({ where: { id: fixture.clienteId } });
        await prisma.sucursal.delete({ where: { id: fixture.sucursalId } });
      } catch (error) {
        failures.push(error);
      }
    }
    if (runtimeRoleCreated) {
      try {
        await prisma.$executeRawUnsafe(`DROP OWNED BY "${runtimeRole}"`);
        await prisma.$executeRawUnsafe(`DROP ROLE "${runtimeRole}"`);
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      await prisma.$disconnect();
    } catch (error) {
      failures.push(error);
    }
    try {
      await releaseLease();
    } catch (error) {
      failures.push(error);
    }
    if (failures.length) {
      throw new AggregateError(failures, "T12 authority integration cleanup failed");
    }
  });

  await assert.doesNotReject(() =>
    prisma.$transaction((tx) => assertVentaNumberingAuthority(tx)),
  );

  await prisma.$executeRawUnsafe(`CREATE ROLE "${runtimeRole}" NOLOGIN`);
  runtimeRoleCreated = true;
  const sucursal = await prisma.sucursal.create({
    data: { nombre: `T12 Writer ${runtimeRole}`, esPrincipal: false },
  });
  const cliente = await prisma.cliente.create({
    data: { nombre: `T12 Writer ${runtimeRole}`, sucursalId: sucursal.id },
  });
  fixture = { sucursalId: sucursal.id, clienteId: cliente.id };
  await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
  await prisma.$executeRawUnsafe(
    `GRANT SELECT, INSERT ON public."Venta" TO "${runtimeRole}"`,
  );
  await prisma.$executeRawUnsafe(
    `GRANT USAGE, SELECT ON SEQUENCE public."Venta_id_seq" TO "${runtimeRole}"`,
  );
  await assert.doesNotReject(() =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${runtimeRole}"`);
      const venta = await createVentaWithAuthority(tx, {
        data: {
          clienteId: cliente.id,
          sucursalId: sucursal.id,
          total: 10,
        },
      });
      assert.equal(venta.numeroVenta, 1);
    }),
  );

  await prisma.$executeRawUnsafe(
    `GRANT SELECT ON public."VentaNumerador" TO "${runtimeRole}"`,
  );
  counterGrantDrifted = true;
  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${runtimeRole}"`);
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );
  await prisma.$executeRawUnsafe(
    `REVOKE SELECT ON public."VentaNumerador" FROM "${runtimeRole}"`,
  );
  counterGrantDrifted = false;

  await prisma.$executeRawUnsafe(
    `ALTER FUNCTION public.t12_assign_venta_numero() SET work_mem = '1MB'`,
  );
  functionConfigDrifted = true;
  await assert.rejects(
    () => prisma.$transaction((tx) => assertVentaNumberingAuthority(tx)),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );
  await prisma.$executeRawUnsafe(
    `ALTER FUNCTION public.t12_assign_venta_numero() RESET work_mem`,
  );
  functionConfigDrifted = false;

  await expectAuthorityDriftRejected(async (tx) => {
    await tx.$executeRawUnsafe(
      `ALTER FUNCTION public.t12_assign_venta_numero() IMMUTABLE`,
    );
  });

  await expectAuthorityDriftRejected(async (tx) => {
    await tx.$executeRawUnsafe(`
      ALTER TABLE public."VentaNumerador"
      DROP CONSTRAINT "VentaNumerador_ultimoNumero_check",
      ADD CONSTRAINT "VentaNumerador_ultimoNumero_check"
        CHECK ("ultimoNumero" >= 0) NOT VALID
    `);
  });

  await expectAuthorityDriftRejected(async (tx) => {
    await tx.$executeRawUnsafe(`
      ALTER TABLE public."VentaNumerador"
      DROP CONSTRAINT "VentaNumerador_pkey",
      ADD CONSTRAINT "VentaNumerador_pkey"
        PRIMARY KEY ("sucursalId") DEFERRABLE INITIALLY IMMEDIATE
    `);
  });

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          CREATE FUNCTION public.t12_overwrite_venta_numero()
          RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN
            NEW."numeroVenta" := 999999;
            RETURN NEW;
          END;
          $$
        `);
        await tx.$executeRawUnsafe(`
          CREATE TRIGGER "t12_z_overwrite_venta_numero"
          BEFORE INSERT ON public."Venta"
          FOR EACH ROW EXECUTE FUNCTION public.t12_overwrite_venta_numero()
        `);
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          DO $$
          DECLARE check_name text;
          BEGIN
            SELECT conname INTO check_name
            FROM pg_catalog.pg_constraint
            WHERE conrelid = 'public."VentaNumerador"'::regclass
              AND contype = 'c';
            EXECUTE format(
              'ALTER TABLE public."VentaNumerador" DROP CONSTRAINT %I',
              check_name
            );
          END;
          $$
        `);
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX public."Venta_sucursalId_numeroVenta_key_t12"`,
        );
        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX "Venta_sucursalId_numeroVenta_key_t12"
          ON public."Venta" ("sucursalId", "numeroVenta", ((id + 0)))
        `);
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX public."Venta_sucursalId_numeroVenta_key_t12"`,
        );
        await tx.$executeRawUnsafe(`
          CREATE UNIQUE INDEX "Venta_sucursalId_numeroVenta_key_t12"
          ON public."Venta" ("sucursalId", "numeroVenta") NULLS NOT DISTINCT
        `);
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica'");
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );

  await prisma.$transaction(async (tx) => {
    await assertVentaNumberingAuthority(tx);
    const ddlClient = new Client({ connectionString: databaseUrl });
    await ddlClient.connect();
    try {
      await ddlClient.query("SET lock_timeout = '100ms'");
      await assert.rejects(
        () =>
          ddlClient.query(
            `ALTER TABLE public."Venta" DISABLE TRIGGER "t12_assign_venta_numero"`,
          ),
        /lock timeout/,
      );
    } finally {
      await ddlClient.end();
    }
  });

  await assert.rejects(
    () =>
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "t12_assign_venta_numero" ON public."Venta"`,
        );
        await tx.$executeRawUnsafe(
          `DROP FUNCTION public.t12_assign_venta_numero()`,
        );
        await tx.$executeRawUnsafe(
          `DROP INDEX public."Venta_sucursalId_numeroVenta_key_t12"`,
        );
        await tx.$executeRawUnsafe(`DROP TABLE public."VentaNumerador"`);
        await assertVentaNumberingAuthority(tx);
      }),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );

  await prisma.$executeRawUnsafe(
    `ALTER TABLE public."Venta" DISABLE TRIGGER "t12_assign_venta_numero"`,
  );
  triggerDisabled = true;
  await assert.rejects(
    () => prisma.$transaction((tx) => assertVentaNumberingAuthority(tx)),
    new RegExp(VENTA_NUMBERING_AUTHORITY_REQUIRED),
  );
});

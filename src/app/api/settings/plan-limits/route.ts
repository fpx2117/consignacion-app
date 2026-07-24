import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { PLAN_LIMITS_DEFAULTS } from "@/constants/subscriptions";

type PlanLimitsPatchBody = {
  planId?: number;
  maxProductos?: number;
  maxUsuarios?: number;
  allowConsignaciones?: boolean;
  allowSucursales?: boolean;
};

/**
 * GET: Lista los límites de todos los planes.
 * Si un plan no tiene PlanLimit en DB, retorna los defaults.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const plans = await prisma.plan.findMany({
      where: { activo: true },
      orderBy: { id: "asc" },
    });

    // Load limits separately to avoid Prisma type cache issues
    const allLimits = await prisma.planLimit.findMany();
    const limitsMap = new Map(allLimits.map((limit) => [limit.planId, limit]));

    const result = plans.map((plan) => {
      const planLimits = limitsMap.get(plan.id);
      return {
        planId: plan.id,
        planNombre: plan.nombre,
        maxProductos:
          planLimits?.maxProductos ??
          PLAN_LIMITS_DEFAULTS[plan.id]?.maxProductos ??
          -1,
        maxUsuarios:
          planLimits?.maxUsuarios ??
          PLAN_LIMITS_DEFAULTS[plan.id]?.maxUsuarios ??
          5,
        allowConsignaciones:
          planLimits?.allowConsignaciones ??
          PLAN_LIMITS_DEFAULTS[plan.id]?.allowConsignaciones ??
          false,
        allowSucursales:
          planLimits?.allowSucursales ??
          PLAN_LIMITS_DEFAULTS[plan.id]?.allowSucursales ??
          false,
      };
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error obteniendo plan limits:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * PATCH: Edita los límites de un plan específico.
 * Body: { planId, maxProductos?, maxUsuarios?, allowConsignaciones?, allowSucursales? }
 */
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = (await req
      .json()
      .catch(() => null)) as PlanLimitsPatchBody | null;
    if (!body?.planId) {
      return NextResponse.json(
        { error: "planId es requerido" },
        { status: 400 },
      );
    }

    const {
      planId,
      maxProductos,
      maxUsuarios,
      allowConsignaciones,
      allowSucursales,
    } = body;

    // Verificar que el plan existe
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json(
        { error: "Plan no encontrado" },
        { status: 404 },
      );
    }

    const defaults = PLAN_LIMITS_DEFAULTS[planId] ?? PLAN_LIMITS_DEFAULTS[1];

    const updated = await prisma.planLimit.upsert({
      where: { planId },
      create: {
        planId,
        maxProductos: maxProductos ?? defaults.maxProductos,
        maxUsuarios: maxUsuarios ?? defaults.maxUsuarios,
        allowConsignaciones:
          allowConsignaciones ?? defaults.allowConsignaciones,
        allowSucursales: allowSucursales ?? defaults.allowSucursales,
      },
      update: {
        ...(maxProductos !== undefined && { maxProductos }),
        ...(maxUsuarios !== undefined && { maxUsuarios }),
        ...(allowConsignaciones !== undefined && { allowConsignaciones }),
        ...(allowSucursales !== undefined && { allowSucursales }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error actualizando plan limits:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

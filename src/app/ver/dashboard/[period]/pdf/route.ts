// src/app/ver/dashboard/[period]/pdf/route.ts
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import type { Page } from "puppeteer-core";
import { getSharedReportBrowser } from "@/lib/chromium/resolve-executable-path";
import {
  withChromiumSlot,
  ChromiumBusyError,
} from "@/lib/chromium/chromium-semaphore";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveTimezone } from "@/lib/timezone/get-configured-tz";
import { prisma } from "@/lib/prisma";
import { getDashboardKpis } from "@/lib/dashboard/kpi-logic";
import { getBranding } from "@/lib/reports/get-branding";
import {
  buildDashboardReportHtml,
  type DashboardReportData,
} from "@/lib/reports/base/dashboard-report-template";
import { nowAR, formatDateTimeAR } from "@/lib/date-format/utils-date";
import {
  DashboardDateRangeError,
  dashboardPeriodLabel,
  parseDashboardDateQuery,
  resolveDashboardDateWhere,
} from "@/lib/dashboard/date-range";
import { resolveReportShareLink } from "@/lib/reports/resolve-report-share-link";
import { hashCode, verifyViewCookie } from "@/lib/sharing/share-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GastoDetalleRecord = Prisma.GastoGetPayload<{
  select: {
    monto: true;
    motivo: true;
    fecha: true;
    categoria: { select: { nombre: true } };
  };
}>;

type GastoCompartidoDetalleRecord = Prisma.GastoSucursalGetPayload<{
  select: {
    montoProporcional: true;
    gasto: {
      select: {
        motivo: true;
        fecha: true;
        categoria: { select: { nombre: true } };
      };
    };
  };
}>;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ period: string }> },
) {
  let page: Page | null = null;

  try {
    const { period: rawPeriod } = await params;
    const { searchParams } = new URL(req.url);
    const periodParams = new URLSearchParams(searchParams);
    periodParams.set("period", rawPeriod);
    let dateQuery;
    try {
      dateQuery = parseDashboardDateQuery(periodParams);
    } catch (error) {
      if (error instanceof DashboardDateRangeError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    const { period, range } = dateQuery;
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }
    const shareLink = await resolveReportShareLink({
      code,
      expectedType: "REPORTE_DASHBOARD",
      period,
      requestedRange: range,
      hasViewedCookie: verifyViewCookie(
        code,
        req.cookies.get(`v_${hashCode(code)}`)?.value,
      ),
    });
    if (!shareLink) {
      return NextResponse.json({ error: "Enlace invalido" }, { status: 403 });
    }
    const auth = await requireAuth();
    const authUserId = auth.ok ? Number(auth.user.sub) : null;
    const userId = Number.isFinite(authUserId) ? authUserId : null;
    const scopedSucursalId = shareLink.sucursalId;
    const isGlobal = scopedSucursalId === 0;

    const timezone = await resolveTimezone({
      userId,
      sucursalId: scopedSucursalId,
    });
    const tz = timezone.tz;
    const dateWhere = resolveDashboardDateWhere(period, nowAR(tz), tz, range);
    const sucursalWhere = isGlobal ? {} : { sucursalId: scopedSucursalId };

    // 1. Usar getDashboardKpis como única fuente de verdad para KPIs financieros
    //    (garantiza consistencia exacta con el Dashboard UI)
    const [
      kpis,
      consigCerradas,
      tendenciaSeries,
      gastosPropiosDetalle,
      gastosLinksDetalle,
    ] = await Promise.all([
      getDashboardKpis(
        scopedSucursalId,
        period,
        isGlobal,
        userId ?? undefined,
        range,
      ),

      // Consignaciones cerradas (kpi-logic no lo expone)
      prisma.consignacion.count({
        where: { ...sucursalWhere, estado: "CERRADA" },
      }),

      // Tendencia diaria (solo si el period no es "all")
      period !== "all"
        ? prisma.venta.findMany({
            where: { ...sucursalWhere, fecha: dateWhere, anulada: false },
            select: { fecha: true, total: true, descuentoGlobal: true },
            orderBy: { fecha: "asc" },
          })
        : Promise.resolve([]),

      // Gastos propios PAGADO no compartidos — solo para tabla de detalle
      prisma.gasto.findMany({
        where: isGlobal
          ? { esCompartido: false, fecha: dateWhere, estado: "PAGADO" }
          : {
              sucursalId: scopedSucursalId,
              esCompartido: false,
              fecha: dateWhere,
              estado: "PAGADO",
            },
        select: {
          monto: true,
          motivo: true,
          fecha: true,
          categoria: { select: { nombre: true } },
        },
        orderBy: { fecha: "asc" },
      }),

      // Participación proporcional en gastos compartidos — solo para tabla de detalle
      isGlobal
        ? prisma.gasto.findMany({
            where: { fecha: dateWhere, estado: "PAGADO", esCompartido: true },
            select: {
              monto: true,
              motivo: true,
              fecha: true,
              categoria: { select: { nombre: true } },
            },
            orderBy: { fecha: "asc" },
          })
        : prisma.gastoSucursal.findMany({
            where: {
              sucursalId: scopedSucursalId,
              gasto: { fecha: dateWhere, estado: "PAGADO", esCompartido: true },
            },
            select: {
              montoProporcional: true,
              gasto: {
                select: {
                  motivo: true,
                  fecha: true,
                  categoria: { select: { nombre: true } },
                },
              },
            },
            orderBy: { gasto: { fecha: "asc" } },
          }),
    ]);

    // 2. Extraer KPIs directamente desde getDashboardKpis (fuente de verdad)
    const gananciaBruta = kpis.finanzas.ganancia.bruta;
    const gananciaConsig = kpis.finanzas.ganancia.porConsig;
    const gananciaDirecta = kpis.finanzas.ganancia.porPos;
    const totalGastos = kpis.gastos.total;
    const utilidadNeta = kpis.finanzas.ganancia.neta;
    const gananciaNeta = kpis.finanzas.ganancia.netaSinGastos;
    const unitsPendientes = kpis.consignacionUnits?.pendientes ?? 0;

    // 3. Tendencia (aggregate by date string)
    const tendenciaMap = new Map<
      string,
      { ventasTotal: number; pagosTotal: number }
    >();

    if (period !== "all" && Array.isArray(tendenciaSeries)) {
      for (const row of tendenciaSeries) {
        const dateStr = new Date(row.fecha).toLocaleDateString("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          timeZone: tz,
        });
        const existing = tendenciaMap.get(dateStr) ?? {
          ventasTotal: 0,
          pagosTotal: 0,
        };
        const totalNeto = Number(row.total) - Number(row.descuentoGlobal || 0);
        existing.ventasTotal += totalNeto;
        tendenciaMap.set(dateStr, existing);
      }
    }

    const tendencia = Array.from(tendenciaMap.entries()).map(([date, v]) => ({
      date,
      ...v,
    }));

    // 4. Tabla de detalle de gastos
    function formatDateShort(d: Date | string): string {
      return new Date(d).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: tz,
      });
    }

    const gastosDetalle = [
      ...(gastosPropiosDetalle as GastoDetalleRecord[]).map((g) => ({
        motivo: g.motivo as string,
        categoria: g.categoria?.nombre ?? "Sin categoría",
        monto: Number(g.monto),
        fecha: formatDateShort(g.fecha),
        esCompartido: false,
      })),
      ...(
        gastosLinksDetalle as Array<
          GastoDetalleRecord | GastoCompartidoDetalleRecord
        >
      ).map((g) => {
        if ("gasto" in g) {
          return {
            motivo: g.gasto.motivo,
            categoria: g.gasto.categoria?.nombre ?? "Sin categoría",
            monto: Number(g.montoProporcional),
            fecha: formatDateShort(g.gasto.fecha),
            esCompartido: true,
          };
        }

        return {
          motivo: g.motivo,
          categoria: g.categoria?.nombre ?? "Sin categoría",
          monto: Number(g.monto),
          fecha: formatDateShort(g.fecha),
          esCompartido: true,
        };
      }),
    ].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const reportData: DashboardReportData = {
      period,
      periodLabel: dashboardPeriodLabel(period, range),
      fechaGeneracion: formatDateTimeAR(new Date(), true, tz),
      gananciaBruta,
      gananciaNeta,
      gananciaConsignacion: gananciaConsig,
      gananciaDirecta,
      gastos: totalGastos,
      utilidadNeta,
      ingresosCaja: kpis.finanzas.pagos.total,
      cantidadVentas: kpis.finanzas.ventas.cantidad,
      cantidadPagos: kpis.finanzas.pagos.cantidad,
      catalogoVisitas: kpis.catalogo?.visitas ?? 0,
      catalogoVisitantesUnicos: kpis.catalogo?.visitantesUnicos ?? 0,
      catalogoProductosVisibles: kpis.catalogo?.productosVisibles ?? 0,
      stockDisponible: kpis.stock?.disponible ?? 0,
      stockConsignado: kpis.stock?.consignado ?? 0,
      consignacionesAbiertas: kpis.countAbiertas,
      consignacionesCerradas: consigCerradas,
      unitsPendientes,
      saldoGlobal: kpis.finanzas.saldoClientesTotal ?? 0,
      tendencia,
      gastosDetalle,
    };

    const branding = await getBranding(
      isGlobal ? (timezone.sucursalId ?? undefined) : scopedSucursalId,
    );
    const htmlContent = buildDashboardReportHtml(reportData, branding);

    // 4. Puppeteer PDF
    const pdfBytes = await withChromiumSlot(async () => {
      const browser = await getSharedReportBrowser();
      page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
      await page.emulateMediaType("screen");

      const bytes = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
      });

      await page.close();
      return bytes;
    });

    const filenameLabel = reportData.periodLabel.replace(/[^a-zA-Z0-9]+/g, "-");
    const filename = `Reporte-Dashboard-${filenameLabel}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ChromiumBusyError) {
      return NextResponse.json(
        {
          error:
            "Servidor ocupado generando otros reportes, reintentá en unos segundos.",
        },
        { status: 503 },
      );
    }
    console.error("PDF DASHBOARD ERROR:", error);
    return NextResponse.json(
      { error: "Error generando reporte" },
      { status: 500 },
    );
  } finally {
    try {
      await (page as Page | null)?.close();
    } catch {}
  }
}

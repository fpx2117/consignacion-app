// src/app/ver/dashboard/[period]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";
import { getDashboardKpis } from "@/lib/kpi-logic";
import { getBranding } from "@/lib/reports/get-branding";
import { buildDashboardReportHtml, type DashboardReportData } from "@/lib/reports/base/dashboard-report-template";
import { getConfiguredTz } from "@/lib/get-configured-tz";
import { nowAR, startOfDayAR, startOfWeekAR, startOfMonthAR, formatDateTimeAR } from "@/lib/utils-date";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Period = "today" | "week" | "month" | "all";

function getPeriodStart(period: Period, tz: string): Date | undefined {
    if (period === "all") return undefined;
    const now = nowAR(tz);
    if (period === "today") return startOfDayAR(now, tz);
    if (period === "week") return startOfWeekAR(now, tz);
    return startOfMonthAR(now, tz);
}

function getPeriodLabel(period: Period): string {
    const labels: Record<Period, string> = {
        today: "Hoy",
        week: "Esta semana",
        month: "Este mes",
        all: "Histórico",
    };
    return labels[period] ?? period;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ period: string }> }
) {
    let browser: Browser | null = null;

    try {
        const { period: rawPeriod } = await params;
        const VALID_PERIODS: Period[] = ["today", "week", "month", "all"];
        const period: Period = VALID_PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : "month";

        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const sucursalId = Number(searchParams.get("sucursalId") || 1);

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const tz = await getConfiguredTz(sucursalId);
        const start = getPeriodStart(period, tz);
        const dateWhere = start ? { gte: start } : undefined;
        const sucursalWhere = { sucursalId };

        // 1. Usar getDashboardKpis como única fuente de verdad para KPIs financieros
        //    (garantiza consistencia exacta con el Dashboard UI)
        const kpiPeriod = period === "all" ? "month" : period;
        const [
            kpis,
            consigCerradas,
            tendenciaSeries,
            gastosPropiosDetalle,
            gastosLinksDetalle,
        ] = await Promise.all([
            getDashboardKpis(sucursalId, kpiPeriod, false),

            // Consignaciones cerradas (kpi-logic no lo expone)
            prisma.consignacion.count({ where: { ...sucursalWhere, estado: "CERRADA" } }),

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
                where: { sucursalId, esCompartido: false, fecha: dateWhere, estado: "PAGADO" },
                select: {
                    monto: true,
                    motivo: true,
                    fecha: true,
                    categoria: { select: { nombre: true } },
                },
                orderBy: { fecha: "asc" },
            }),

            // Participación proporcional en gastos compartidos — solo para tabla de detalle
            prisma.gastoSucursal.findMany({
                where: {
                    sucursalId,
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
        const gananciaBruta    = kpis.finanzas.ganancia.bruta;
        const gananciaConsig   = kpis.finanzas.ganancia.porConsig;
        const gananciaDirecta  = kpis.finanzas.ganancia.porPos;
        const totalGastos      = kpis.gastos.total;
        const perdidaRotura    = kpis.finanzas.ganancia.perdidaRotura;
        const utilidadNeta     = kpis.finanzas.ganancia.neta;
        const unitsPendientes  = kpis.consignacionUnits?.pendientes ?? 0;

        // 3. Tendencia (aggregate by date string)
        const tendenciaMap = new Map<string, { ventasTotal: number; pagosTotal: number }>();

        if (period !== "all" && Array.isArray(tendenciaSeries)) {
            for (const row of tendenciaSeries) {
                const dateStr = new Date(row.fecha).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    timeZone: tz,
                });
                const existing = tendenciaMap.get(dateStr) ?? { ventasTotal: 0, pagosTotal: 0 };
                const totalNeto = Number(row.total) - Number(row.descuentoGlobal || 0);
                existing.ventasTotal += totalNeto;
                tendenciaMap.set(dateStr, existing);
            }
        }

        const tendencia = Array.from(tendenciaMap.entries()).map(([date, v]) => ({ date, ...v }));

        // 4. Tabla de detalle de gastos
        function formatDateShort(d: Date | string): string {
            return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });
        }

        const gastosDetalle = [
            ...(gastosPropiosDetalle as any[]).map((g: any) => ({
                motivo: g.motivo as string,
                categoria: g.categoria?.nombre ?? "Sin categoría",
                monto: Number(g.monto),
                fecha: formatDateShort(g.fecha),
                esCompartido: false,
            })),
            ...(gastosLinksDetalle as any[]).map((g: any) => ({
                motivo: g.gasto.motivo as string,
                categoria: g.gasto.categoria?.nombre ?? "Sin categoría",
                monto: Number(g.montoProporcional),
                fecha: formatDateShort(g.gasto.fecha),
                esCompartido: true,
            })),
        ].sort((a, b) => a.fecha.localeCompare(b.fecha));

        const reportData: DashboardReportData = {
            period,
            periodLabel: getPeriodLabel(period),
            fechaGeneracion: formatDateTimeAR(new Date(), true, tz),
            gananciaBruta,
            gananciaConsignacion: gananciaConsig,
            gananciaDirecta,
            gastos: totalGastos,
            utilidadNeta,
            ingresosCaja: kpis.finanzas.pagos.total,
            cantidadVentas: kpis.finanzas.ventas.cantidad,
            cantidadPagos: kpis.finanzas.pagos.cantidad,
            catalogoVisitas: kpis.catalogo?.visitas ?? 0,
            catalogoVisitantesUnicos: kpis.catalogo?.visitantesUnicos ?? 0,
            stockDisponible: kpis.stock?.disponible ?? 0,
            stockConsignado: kpis.stock?.consignado ?? 0,
            consignacionesAbiertas: kpis.countAbiertas,
            consignacionesCerradas: consigCerradas,
            unitsPendientes,
            tendencia,
            gastosDetalle,
        };

        const branding = await getBranding(sucursalId);
        const htmlContent = buildDashboardReportHtml(reportData, branding);

        // 4. Puppeteer PDF
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
        await page.emulateMediaType("screen");

        const pdfBytes = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
        });

        await browser.close();
        browser = null;

        const filename = `Reporte-Dashboard-${reportData.periodLabel.replace(/\s+/g, "-")}.pdf`;

        return new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("PDF DASHBOARD ERROR:", error);
        return NextResponse.json({ error: "Error generando reporte" }, { status: 500 });
    } finally {
        try { if (browser) await browser.close(); } catch { }
    }
}

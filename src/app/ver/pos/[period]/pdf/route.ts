// src/app/ver/pos/[period]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/reports/get-branding";
import { buildPosReportHtml, type PosReportData } from "@/lib/reports/base/pos-report-template";
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

const PERIOD_LABELS: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
    all: "Historico",
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ period: string }> }
) {
    let browser: Browser | null = null;
    try {
        const { period: rawPeriod } = await params;
        const VALID: Period[] = ["today", "week", "month", "all"];
        const period: Period = VALID.includes(rawPeriod as Period) ? (rawPeriod as Period) : "month";

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

        const hasCatalogVisitModel = "catalogVisit" in prisma;

        // Fetch data in parallel
        const [ventasAgg, pagosAgg, ventasConDetalles, pagosPorMetodo, gastosAgg, catalogVisitsCount] = await Promise.all([
            // Totales de ventas directas
            prisma.venta.aggregate({
                where: { ...sucursalWhere, fecha: dateWhere, liquidacionId: null },
                _sum: { total: true, descuentoGlobal: true },
                _count: { _all: true },
            }),

            // Cobros en caja — SOLO pagos de tipo VENTA (excluye cobros de deudas de consignación)
            prisma.pago.aggregate({
                where: { ...sucursalWhere, fecha: dateWhere, tipo: "VENTA" },
                _sum: { monto: true },
                _count: { _all: true },
            }),

            // Ventas con sus detalles para ganancia, top productos y tendencia
            prisma.venta.findMany({
                where: { ...sucursalWhere, fecha: dateWhere, liquidacionId: null },
                select: {
                    fecha: true,
                    total: true,
                    descuentoGlobal: true,
                    metodoPago: true,
                    detalles: {
                        select: {
                            precioUnitario: true,
                            units: true,
                            subtotal: true,
                            producto: { select: { nombre: true, precioCosto: true } },
                        },
                    },
                },
                orderBy: { fecha: "asc" },
            }),

            // Por método de pago
            prisma.venta.groupBy({
                by: ["metodoPago"],
                where: { ...sucursalWhere, fecha: dateWhere, liquidacionId: null },
                _sum: { total: true, descuentoGlobal: true },
                _count: { _all: true },
            }),

            // Gastos totales del período para esta sucursal
            prisma.gasto.aggregate({
                where: { sucursalId, ...(start ? { fecha: { gte: start } } : {}) },
                _sum: { monto: true },
                _count: { _all: true },
            }),

            // Visitas al catálogo del período
            hasCatalogVisitModel
                ? (prisma as any).catalogVisit.count({
                    where: { sucursalId, ...(start ? { visitedAt: { gte: start } } : {}) },
                })
                : Promise.resolve(0),
        ]);

        // Procesar ventas para KPIs, Top Productos y Tendencia
        let totalGanancia = 0;
        let totalDescuentosGlob = 0;
        const productoMap = new Map<string, { units: number; total: number; ganancia: number }>();
        const tendenciaMap = new Map<string, { ventasTotal: number; cantidad: number; ganancia: number; unitsVendidas: number }>();

        for (const v of ventasConDetalles) {
            const dateStr = new Date(v.fecha).toLocaleDateString("es-AR", {
                day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz,
            });
            const tPrev = tendenciaMap.get(dateStr) ?? { ventasTotal: 0, cantidad: 0, ganancia: 0, unitsVendidas: 0 };

            const descGlobalVenta = Number(v.descuentoGlobal || 0);
            totalDescuentosGlob += descGlobalVenta;

            let gananciaVenta = 0;
            const netoVenta = Number(v.total) - descGlobalVenta;

            for (const d of v.detalles) {
                const sub = Number(d.subtotal);
                const costoTotal = Number(d.producto?.precioCosto || 0) * d.units;
                const gItem = sub - costoTotal;
                gananciaVenta += gItem;

                const name = d.producto?.nombre ?? "Desconocido";
                const pPrev = productoMap.get(name) ?? { units: 0, total: 0, ganancia: 0 };
                pPrev.units += d.units;
                pPrev.total += sub;
                pPrev.ganancia += gItem;
                productoMap.set(name, pPrev);
            }

            // Aplicar descuento global a la ganancia de la venta
            gananciaVenta -= descGlobalVenta;
            totalGanancia += gananciaVenta;

            tPrev.ventasTotal += netoVenta;
            tPrev.cantidad += 1;
            tPrev.ganancia += gananciaVenta;
            tPrev.unitsVendidas += v.detalles.reduce((acc, d) => acc + (d.units || 0), 0);
            tendenciaMap.set(dateStr, tPrev);
        }

        const topProductos = [...productoMap.entries()]
            .map(([nombre, v]) => ({ nombre, ...v }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        const tendencia = [...tendenciaMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        const totalVentasBruto = Number(ventasAgg._sum?.total ?? 0);
        const totalVentasNeto = totalVentasBruto - totalDescuentosGlob;
        const cantidadVentas = ventasAgg._count?._all ?? 0;

        const reportData: PosReportData = {
            period,
            periodLabel: PERIOD_LABELS[period],
            fechaGeneracion: formatDateTimeAR(new Date(), true, tz),
            totalVentas: totalVentasNeto,
            cantidadVentas,
            totalGanancia,
            ingresosCaja: Number(pagosAgg._sum?.monto ?? 0),
            ticketPromedio: cantidadVentas > 0 ? totalVentasNeto / cantidadVentas : 0,
            gastosTotal: Number(gastosAgg._sum?.monto ?? 0),
            catalogoVisitas: Number(catalogVisitsCount ?? 0),
            pagosPorMetodo: pagosPorMetodo.map(m => ({
                metodo: m.metodoPago,
                total: Number(m._sum.total ?? 0) - Number(m._sum.descuentoGlobal || 0),
                cantidad: m._count._all,
            })),
            topProductos,
            ventas: [],
            tendencia,
        };

        const branding = await getBranding(sucursalId);
        const htmlContent = buildPosReportHtml(reportData, branding);

        browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
        await page.emulateMediaType("screen");

        const pdfBytes = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", bottom: "0", left: "0", right: "0" } });
        await browser.close();
        browser = null;

        return new NextResponse(Buffer.from(pdfBytes), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="Reporte-POS-${PERIOD_LABELS[period].replace(/\s+/g, "-")}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("PDF POS ERROR:", err);
        return NextResponse.json({ error: "Error generando reporte POS" }, { status: 500 });
    } finally {
        try { if (browser) await browser.close(); } catch { }
    }
}

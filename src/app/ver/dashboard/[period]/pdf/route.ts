// src/app/ver/dashboard/[period]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/reports/get-branding";
import { buildDashboardReportHtml, type DashboardReportData } from "@/lib/reports/base/dashboard-report-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Period = "today" | "week" | "month" | "all";

function getPeriodStart(period: Period): Date | undefined {
    if (period === "all") return undefined;
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (period === "today") return start;
    if (period === "week") { start.setDate(start.getDate() - 6); return start; }
    start.setDate(start.getDate() - 29); // month
    return start;
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

function formatDateAR(date: Date): string {
    return date.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ period: string }> }
) {
    let browser: Browser | null = null;

    try {
        const { period: rawPeriod } = await params;
        const validPeriods: Period[] = ["today", "week", "month", "all"];
        const period: Period = validPeriods.includes(rawPeriod as Period)
            ? (rawPeriod as Period)
            : "month";

        const start = getPeriodStart(period);
        const dateWhere = start ? { gte: start } : undefined;

        // 1. Fetch all data in parallel
        const [
            stockAgg,
            consigAbiertas,
            consigCerradas,
            detallesAbiertas,
            ventasAgg,
            pagosAgg,
            itemsLiquidados,
            itemsVentaDirecta,
            tendenciaSeries,
        ] = await Promise.all([
            // Stock
            prisma.stockSucursal.aggregate({ _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true } }),

            // Consignaciones
            prisma.consignacion.count({ where: { estado: "ABIERTA" } }),
            prisma.consignacion.count({ where: { estado: "CERRADA" } }),

            // Unidades pendientes (abiertas)
            prisma.consignacionDetalle.findMany({
                where: { consignacion: { estado: "ABIERTA" } },
                select: { unitsEntregadas: true, unitsVendidasAcum: true, unitsDevueltasAcum: true },
            }),

            // Ventas
            prisma.venta.aggregate({
                where: { fecha: dateWhere },
                _sum: { total: true },
                _count: { _all: true },
            }),

            // Pagos
            prisma.pago.aggregate({
                where: { fecha: dateWhere },
                _sum: { monto: true },
                _count: { _all: true },
            }),

            // Ganancia por consignación
            prisma.liquidacionItem.findMany({
                where: { liquidacion: { fecha: dateWhere } },
                select: {
                    unitsVendidas: true,
                    detalle: {
                        select: {
                            producto: { select: { precioVenta: true, precioCosto: true } },
                            consignacion: { select: { porcentajeAumento: true } },
                        },
                    },
                },
            }),

            // Ganancia ventas directas
            prisma.ventaDetalle.findMany({
                where: { venta: { fecha: dateWhere, liquidacionId: null } },
                select: {
                    precioUnitario: true,
                    units: true,
                    producto: { select: { precioCosto: true } },
                },
            }),

            // Tendencia diaria (solo si el period no es "all")
            period !== "all"
                ? prisma.venta.groupBy({
                    by: ["fecha"],
                    where: { fecha: dateWhere },
                    _sum: { total: true },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),
        ]);

        // 2. Calculations
        let unitsPendientes = 0;
        for (const d of detallesAbiertas) {
            unitsPendientes += d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum;
        }

        let gananciaConsignacion = 0;
        for (const item of itemsLiquidados) {
            const precioBase = Number(item.detalle?.producto?.precioVenta || 0);
            const porcentaje = Number(item.detalle?.consignacion?.porcentajeAumento || 0);
            const costo = Number(item.detalle?.producto?.precioCosto || 0);
            const precioCobrado = precioBase * (1 + porcentaje / 100);
            gananciaConsignacion += (precioCobrado - costo) * item.unitsVendidas;
        }

        let gananciaDirecta = 0;
        for (const item of itemsVentaDirecta) {
            const precio = Number(item.precioUnitario);
            const costo = Number(item.producto?.precioCosto || 0);
            gananciaDirecta += (precio - costo) * item.units;
        }

        // 3. Tendencia (aggregate by date string)
        const tendenciaMap = new Map<string, { ventasTotal: number; pagosTotal: number }>();

        if (period !== "all" && Array.isArray(tendenciaSeries)) {
            for (const row of tendenciaSeries) {
                const dateStr = new Date(row.fecha).toLocaleDateString("es-AR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                });
                const existing = tendenciaMap.get(dateStr) ?? { ventasTotal: 0, pagosTotal: 0 };
                existing.ventasTotal += Number(row._sum.total ?? 0);
                tendenciaMap.set(dateStr, existing);
            }
        }

        const tendencia = Array.from(tendenciaMap.entries()).map(([date, v]) => ({ date, ...v }));

        const reportData: DashboardReportData = {
            period,
            periodLabel: getPeriodLabel(period),
            fechaGeneracion: formatDateAR(new Date()),
            gananciaTotal: gananciaConsignacion + gananciaDirecta,
            gananciaConsignacion,
            gananciaDirecta,
            ingresosCaja: Number(pagosAgg._sum?.monto ?? 0),
            cantidadVentas: ventasAgg._count?._all ?? 0,
            cantidadPagos: pagosAgg._count?._all ?? 0,
            stockDisponible: stockAgg._sum?.stockDisponibleUnits ?? 0,
            stockConsignado: stockAgg._sum?.stockConsignadoUnits ?? 0,
            consignacionesAbiertas: consigAbiertas,
            consignacionesCerradas: consigCerradas,
            unitsPendientes,
            tendencia,
        };

        const branding = await getBranding();
        const htmlContent = buildDashboardReportHtml(reportData, branding);

        // 4. Puppeteer PDF
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
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

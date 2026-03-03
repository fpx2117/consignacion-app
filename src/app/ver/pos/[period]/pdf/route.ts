// src/app/ver/pos/[period]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/reports/get-branding";
import { buildPosReportHtml, type PosReportData } from "@/lib/reports/base/pos-report-template";

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
    start.setDate(start.getDate() - 29);
    return start;
}

const PERIOD_LABELS: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
    all: "Historico",
};

function formatDateAR(d: Date) {
    return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ period: string }> }
) {
    let browser: Browser | null = null;
    try {
        const VALID: Period[] = ["today", "week", "month", "all"];
        const { period: rawPeriod } = await params;
        const period: Period = VALID.includes(rawPeriod as Period) ? (rawPeriod as Period) : "month";

        const start = getPeriodStart(period);
        const dateWhere = start ? { gte: start } : undefined;

        // Fetch data in parallel
        // NOTE: tendencia is computed from ventasConDetalles directly (single pass) to avoid
        // the groupBy(DateTime) bug where all rows in a day share the same date key.
        const [ventasAgg, pagosAgg, detallesVentas, ventasConDetalles, pagosPorMetodo] = await Promise.all([
            // Totales de ventas directas
            prisma.venta.aggregate({
                where: { fecha: dateWhere, liquidacionId: null },
                _sum: { total: true },
                _count: { _all: true },
            }),

            // Cobros totales
            prisma.pago.aggregate({
                where: { fecha: dateWhere },
                _sum: { monto: true },
                _count: { _all: true },
            }),

            // Detalles de ventas directas para ganancia y top productos
            prisma.ventaDetalle.findMany({
                where: { venta: { fecha: dateWhere, liquidacionId: null } },
                select: {
                    precioUnitario: true,
                    units: true,
                    subtotal: true,
                    producto: { select: { nombre: true, precioCosto: true } },
                    venta: { select: { metodoPago: true, clienteId: true, cliente: { select: { nombre: true } } } },
                },
            }),

            // Ventas con sus detalles para tendencia (un solo pass, sin groupBy por DateTime)
            period !== "all"
                ? prisma.venta.findMany({
                    where: { fecha: dateWhere, liquidacionId: null },
                    select: {
                        fecha: true,
                        total: true,
                        detalles: {
                            select: {
                                precioUnitario: true,
                                units: true,
                                producto: { select: { precioCosto: true } },
                            },
                        },
                    },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),

            // Por método de pago
            prisma.venta.groupBy({
                by: ["metodoPago"],
                where: { fecha: dateWhere, liquidacionId: null },
                _sum: { total: true },
                _count: { _all: true },
            }),
        ]);

        // Ganancia total + ganancias para tendencia
        let totalGanancia = 0;
        const productoMapGanancia = new Map<string, { units: number; total: number; ganancia: number }>();

        for (const d of detallesVentas) {
            const precio = Number(d.precioUnitario);
            const costo = Number(d.producto?.precioCosto || 0);
            const gananciaItem = (precio - costo) * d.units;
            totalGanancia += gananciaItem;

            const key = d.producto?.nombre ?? "Desconocido";
            const prev = productoMapGanancia.get(key) ?? { units: 0, total: 0, ganancia: 0 };
            prev.units += d.units;
            prev.total += Number(d.subtotal);
            prev.ganancia += gananciaItem;
            productoMapGanancia.set(key, prev);
        }

        const topProductos = [...productoMapGanancia.entries()]
            .map(([nombre, v]) => ({ nombre, ...v }))
            .sort((a, b) => b.total - a.total);

        // ─ Tendencia: un solo pass sobre ventasConDetalles, agrupando por día
        // (evita el bug de groupBy DateTime donde múltiples timestamps del mismo
        // día comparten la misma clave de fecha string y suman ganancia incorrectamente)
        const tendenciaMap = new Map<string, { ventasTotal: number; cantidad: number; ganancia: number }>();

        if (Array.isArray(ventasConDetalles)) {
            for (const venta of ventasConDetalles) {
                const dateStr = new Date(venta.fecha).toLocaleDateString("es-AR", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                });
                const prev = tendenciaMap.get(dateStr) ?? { ventasTotal: 0, cantidad: 0, ganancia: 0 };
                prev.ventasTotal += Number(venta.total);
                prev.cantidad += 1;
                for (const d of venta.detalles) {
                    prev.ganancia += (Number(d.precioUnitario) - Number(d.producto?.precioCosto || 0)) * d.units;
                }
                tendenciaMap.set(dateStr, prev);
            }
        }

        const tendencia = [...tendenciaMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v }));

        const totalVentas = Number(ventasAgg._sum?.total ?? 0);
        const cantidadVentas = ventasAgg._count?._all ?? 0;

        const reportData: PosReportData = {
            period,
            periodLabel: PERIOD_LABELS[period],
            fechaGeneracion: formatDateAR(new Date()),
            totalVentas,
            cantidadVentas,
            totalGanancia,
            ingresosCaja: Number(pagosAgg._sum?.monto ?? 0),
            ticketPromedio: cantidadVentas > 0 ? totalVentas / cantidadVentas : 0,
            pagosPorMetodo: pagosPorMetodo.map(m => ({
                metodo: m.metodoPago,
                total: Number(m._sum.total ?? 0),
                cantidad: m._count._all,
            })),
            topProductos,
            ventas: [],
            tendencia,
        };

        const branding = await getBranding();
        const htmlContent = buildPosReportHtml(reportData, branding);

        browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();

        await page.setContent(htmlContent, { waitUntil: "networkidle2" });
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

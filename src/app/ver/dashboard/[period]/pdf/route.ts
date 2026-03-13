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
        const VALID_PERIODS: Period[] = ["today", "week", "month", "all"];
        const period: Period = VALID_PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : "month";

        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const sucursalId = Number(searchParams.get("sucursalId") || 1);

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const start = getPeriodStart(period);
        const dateWhere = start ? { gte: start } : undefined;
        const sucursalWhere = { sucursalId };

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
            gastosPropiosAgg,
            gastosLinksData,
            catalogoVisitas,
            catalogoVisitantes,
        ] = await Promise.all([
            // Stock
            prisma.stockSucursal.aggregate({ where: sucursalWhere, _sum: { stockDisponibleUnits: true, stockConsignadoUnits: true } }),

            // Consignaciones
            prisma.consignacion.count({ where: { ...sucursalWhere, estado: "ABIERTA" } }),
            prisma.consignacion.count({ where: { ...sucursalWhere, estado: "CERRADA" } }),

            // Unidades pendientes (abiertas)
            prisma.consignacionDetalle.findMany({
                where: { consignacion: { ...sucursalWhere, estado: "ABIERTA" } },
                select: { unitsEntregadas: true, unitsVendidasAcum: true, unitsDevueltasAcum: true },
            }),

            // Ventas
            prisma.venta.aggregate({
                where: { ...sucursalWhere, fecha: dateWhere },
                _sum: { total: true },
                _count: { _all: true },
            }),

            // Pagos
            prisma.pago.aggregate({
                where: { ...sucursalWhere, fecha: dateWhere },
                _sum: { monto: true },
                _count: { _all: true },
            }),

            // Ganancia por consignación
            prisma.liquidacionItem.findMany({
                where: { liquidacion: { fecha: dateWhere, consignacion: sucursalWhere } },
                select: {
                    unitsVendidas: true,
                    precioUnitario: true,
                    descuento: true,
                    detalle: {
                        select: {
                            producto: { select: { precioCosto: true } },
                        },
                    },
                },
            }),

            // Ganancia ventas directas + Descuentos Globales
            prisma.venta.findMany({
                where: { ...sucursalWhere, fecha: dateWhere },
                select: {
                    descuentoGlobal: true,
                    detalles: {
                        select: {
                            precioUnitario: true,
                            subtotal: true,
                            units: true,
                            producto: { select: { precioCosto: true } },
                        },
                    },
                },
            }),

            // Tendencia diaria (solo si el period no es "all")
            period !== "all"
                ? prisma.venta.findMany({
                    where: { ...sucursalWhere, fecha: dateWhere },
                    select: { fecha: true, total: true, descuentoGlobal: true },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),

            // Gastos propios PAGADO no compartidos (con detalle)
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

            // Participación proporcional en gastos compartidos (con detalle)
            prisma.gastoSucursal.findMany({
                where: {
                    sucursalId,
                    gasto: { fecha: dateWhere, estado: "PAGADO" },
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

            // Catalogo (visitas)
            (prisma as any).catalogVisit.count({
                where: {
                    sucursalId,
                    ...(dateWhere ? { visitedAt: dateWhere } : {}),
                },
            }),
            (prisma as any).catalogVisit.groupBy({
                by: ["visitorHash"],
                where: {
                    sucursalId,
                    ...(dateWhere ? { visitedAt: dateWhere } : {}),
                },
            }),
        ]);

        // 2. Calculations
        let unitsPendientes = 0;
        for (const d of detallesAbiertas) {
            unitsPendientes += d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum;
        }

        let gananciaConsignacion = 0;
        for (const item of itemsLiquidados) {
            const precioVenta = Number(item.precioUnitario);
            const descuento = Number(item.descuento || 0);
            const costo = Number(item.detalle?.producto?.precioCosto || 0) * item.unitsVendidas;
            gananciaConsignacion += (precioVenta * item.unitsVendidas - descuento - costo);
        }

        let gananciaDirecta = 0;
        let totalDescuentosEscrito = 0;
        for (const v of itemsVentaDirecta) {
            let gananciaVenta = 0;
            for (const det of v.detalles) {
                const subtotal = Number(det.subtotal);
                const costo = Number(det.producto?.precioCosto || 0) * det.units;
                gananciaVenta += (subtotal - costo);
            }
            gananciaVenta -= Number(v.descuentoGlobal || 0);
            totalDescuentosEscrito += Number(v.descuentoGlobal || 0);
            gananciaDirecta += gananciaVenta;
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
                const totalNeto = Number(row.total) - Number(row.descuentoGlobal || 0);
                existing.ventasTotal += totalNeto;
                tendenciaMap.set(dateStr, existing);
            }
        }

        const tendencia = Array.from(tendenciaMap.entries()).map(([date, v]) => ({ date, ...v }));

        // Gastos: propios no compartidos + proporcional en compartidos
        const totalGastosPropios = (gastosPropiosAgg as any[]).reduce(
            (acc: number, g: any) => acc + Number(g.monto), 0
        );
        const totalGastosLinks = (gastosLinksData as any[]).reduce(
            (acc: number, g: any) => acc + Number(g.montoProporcional), 0
        );
        const totalGastos = totalGastosPropios + totalGastosLinks;

        function formatDateShort(d: Date | string): string {
            return new Date(d).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
        }

        const gastosDetalle = [
            ...(gastosPropiosAgg as any[]).map((g: any) => ({
                motivo: g.motivo as string,
                categoria: g.categoria?.nombre ?? "Sin categoría",
                monto: Number(g.monto),
                fecha: formatDateShort(g.fecha),
                esCompartido: false,
            })),
            ...(gastosLinksData as any[]).map((g: any) => ({
                motivo: g.gasto.motivo as string,
                categoria: g.gasto.categoria?.nombre ?? "Sin categoría",
                monto: Number(g.montoProporcional),
                fecha: formatDateShort(g.gasto.fecha),
                esCompartido: true,
            })),
        ].sort((a, b) => a.fecha.localeCompare(b.fecha));

        const gananciaBruta = gananciaConsignacion + gananciaDirecta;
        const utilidadNeta = gananciaBruta - totalGastos;

        const reportData: DashboardReportData = {
            period,
            periodLabel: getPeriodLabel(period),
            fechaGeneracion: formatDateAR(new Date()),
            gananciaBruta,
            gananciaConsignacion,
            gananciaDirecta,
            gastos: totalGastos,
            utilidadNeta,
            ingresosCaja: Number(pagosAgg._sum?.monto ?? 0),
            cantidadVentas: ventasAgg._count?._all ?? 0,
            cantidadPagos: pagosAgg._count?._all ?? 0,
            catalogoVisitas,
            catalogoVisitantesUnicos: catalogoVisitantes.length,
            stockDisponible: stockAgg._sum?.stockDisponibleUnits ?? 0,
            stockConsignado: stockAgg._sum?.stockConsignadoUnits ?? 0,
            consignacionesAbiertas: consigAbiertas,
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

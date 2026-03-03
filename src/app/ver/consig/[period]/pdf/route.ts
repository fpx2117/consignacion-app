// src/app/ver/consig/[period]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/reports/get-branding";
import { buildConsigReportHtml, type ConsigReportData, type ConsigClienteRow, type ConsigTopProducto } from "@/lib/reports/base/consignacion-report-template";

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

        const [
            consignaciones,
            stockAgg,
            saldoClientesAgg,
            liquidacionesCount,
            liquidacionItems,
            detallesAbiertas,
            tendenciaConsig,
            tendenciaLiquidaciones,
        ] = await Promise.all([
            // Todas las consignaciones con detalles y cliente
            prisma.consignacion.findMany({
                where: dateWhere ? { fecha: dateWhere } : undefined,
                include: {
                    cliente: true,
                    detalles: {
                        include: {
                            producto: { select: { nombre: true, precioVenta: true, precioCosto: true } },
                            liquidacionItems: true,
                        },
                    },
                    liquidaciones: {
                        include: {
                            items: {
                                include: {
                                    detalle: {
                                        include: {
                                            producto: { select: { precioVenta: true, precioCosto: true } },
                                            consignacion: { select: { porcentajeAumento: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                orderBy: { fecha: "desc" },
                take: 50,
            }),

            // Stock consignado total
            prisma.stockSucursal.aggregate({ _sum: { stockConsignadoUnits: true } }),

            // Saldo pendiente clientes
            prisma.cliente.aggregate({ _sum: { saldoCuenta: true } }),

            // Cantidad de liquidaciones en período
            prisma.liquidacion.count({ where: { fecha: dateWhere } }),

            // Items liquidados para ganancia
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

            // Unidades pendientes (consiguiendo ABIERTAS)
            prisma.consignacionDetalle.findMany({
                where: { consignacion: { estado: "ABIERTA" } },
                select: { unitsEntregadas: true, unitsVendidasAcum: true, unitsDevueltasAcum: true },
            }),

            // Tendencia: nuevas consignaciones por día
            period !== "all"
                ? prisma.consignacion.groupBy({
                    by: ["fecha"],
                    where: { fecha: dateWhere },
                    _count: { _all: true },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),

            // Tendencia: liquidaciones por día
            period !== "all"
                ? prisma.liquidacion.groupBy({
                    by: ["fecha"],
                    where: { fecha: dateWhere },
                    _count: { _all: true },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),
        ]);

        // ── Cálculo de ganancia total por liquidaciones
        let gananciaTotal = 0;
        for (const item of liquidacionItems) {
            const precioBase = Number(item.detalle?.producto?.precioVenta || 0);
            const pct = Number(item.detalle?.consignacion?.porcentajeAumento || 0);
            const costo = Number(item.detalle?.producto?.precioCosto || 0);
            const precioCobrado = precioBase * (1 + pct / 100);
            gananciaTotal += (precioCobrado - costo) * item.unitsVendidas;
        }

        // ── Unidades pendientes
        let unitsPendientesTotal = 0;
        for (const d of detallesAbiertas) {
            unitsPendientesTotal += Math.max(0, d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum);
        }

        // ── Conteo abierta/cerrada
        const consigAbiertas = consignaciones.filter(c => c.estado === "ABIERTA").length;
        const consigCerradas = consignaciones.filter(c => c.estado === "CERRADA").length;

        // ── Top clientes
        const topClientes: ConsigClienteRow[] = consignaciones.map(c => {
            let gananciaCliente = 0;
            let unitsVendidas = 0;
            let unitsDevueltas = 0;

            for (const liq of c.liquidaciones) {
                for (const item of liq.items) {
                    const precioBase = Number(item.detalle?.producto?.precioVenta || 0);
                    const pct = Number(item.detalle?.consignacion?.porcentajeAumento || 0);
                    const costo = Number(item.detalle?.producto?.precioCosto || 0);
                    const precioCobrado = precioBase * (1 + pct / 100);
                    gananciaCliente += (precioCobrado - costo) * item.unitsVendidas;
                    unitsVendidas += item.unitsVendidas;
                    unitsDevueltas += item.unitsDevueltas;
                }
            }

            let unitsPendientes = 0;
            for (const d of c.detalles) {
                unitsPendientes += Math.max(0, d.unitsEntregadas - d.unitsVendidasAcum - d.unitsDevueltasAcum);
            }

            return {
                clienteNombre: c.cliente?.nombre ?? "Desconocido",
                folioNumero: c.numeroFolio,
                estado: c.estado as "ABIERTA" | "CERRADA",
                fecha: c.fecha,
                unitsPendientes,
                unitsVendidas,
                unitsDevueltas,
                pagosPendiente: Number(c.cliente?.saldoCuenta ?? 0),
                gananciaGenerada: gananciaCliente,
            };
        }).sort((a, b) => b.gananciaGenerada - a.gananciaGenerada);

        // ── Top productos por rotación
        const productoMap = new Map<string, { unitsEntregadas: number; unitsVendidas: number; ganancia: number }>();
        for (const c of consignaciones) {
            const pct = Number(c.porcentajeAumento);
            for (const d of c.detalles) {
                const key = d.producto?.nombre ?? "Desconocido";
                const prev = productoMap.get(key) ?? { unitsEntregadas: 0, unitsVendidas: 0, ganancia: 0 };
                prev.unitsEntregadas += d.unitsEntregadas;
                prev.unitsVendidas += d.unitsVendidasAcum;
                // Calculate ganancia using product prices
                const precioBase = Number(d.producto?.precioVenta || 0);
                const costo = Number(d.producto?.precioCosto || 0);
                const precioCobrado = precioBase * (1 + pct / 100);
                prev.ganancia += (precioCobrado - costo) * d.unitsVendidasAcum;
                productoMap.set(key, prev);
            }
        }

        const topProductos: ConsigTopProducto[] = [...productoMap.entries()]
            .map(([nombre, v]) => ({ nombre, ...v }))
            .sort((a, b) => b.unitsVendidas - a.unitsVendidas);

        // ── Tendencia ganancia per day
        const gananciaByDate = new Map<string, number>();
        if (period !== "all") {
            const liquidacionDetalleRaw = await prisma.liquidacionItem.findMany({
                where: { liquidacion: { fecha: dateWhere } },
                select: {
                    unitsVendidas: true,
                    detalle: {
                        select: {
                            producto: { select: { precioVenta: true, precioCosto: true } },
                            consignacion: { select: { porcentajeAumento: true } },
                        },
                    },
                    liquidacion: { select: { fecha: true } },
                },
            });
            for (const item of liquidacionDetalleRaw) {
                const key = new Date(item.liquidacion.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
                const precioBase = Number(item.detalle?.producto?.precioVenta || 0);
                const pct = Number(item.detalle?.consignacion?.porcentajeAumento || 0);
                const costo = Number(item.detalle?.producto?.precioCosto || 0);
                const g = (precioBase * (1 + pct / 100) - costo) * item.unitsVendidas;
                gananciaByDate.set(key, (gananciaByDate.get(key) ?? 0) + g);
            }
        }

        // Merge tendencia arrays
        const allDatesSet = new Set<string>();
        const tendenciaConsigMap = new Map<string, number>();
        const tendenciaLiqMap = new Map<string, number>();

        if (Array.isArray(tendenciaConsig)) {
            for (const t of tendenciaConsig) {
                const k = new Date(t.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
                tendenciaConsigMap.set(k, t._count._all);
                allDatesSet.add(k);
            }
        }
        if (Array.isArray(tendenciaLiquidaciones)) {
            for (const t of tendenciaLiquidaciones) {
                const k = new Date(t.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
                tendenciaLiqMap.set(k, t._count._all);
                allDatesSet.add(k);
            }
        }

        const tendencia = [...allDatesSet].sort().map(date => ({
            date,
            nuevasConsig: tendenciaConsigMap.get(date) ?? 0,
            liquidaciones: tendenciaLiqMap.get(date) ?? 0,
            ganancia: gananciaByDate.get(date) ?? 0,
        }));

        const unitsVendidasTotal = topClientes.reduce((s, c) => s + c.unitsVendidas, 0);

        const reportData: ConsigReportData = {
            period,
            periodLabel: PERIOD_LABELS[period],
            fechaGeneracion: formatDateAR(new Date()),
            consigAbiertas,
            consigCerradas,
            unitsPendientesTotal,
            unitsVendidasTotal,
            unitsEnCalle: stockAgg._sum?.stockConsignadoUnits ?? 0,
            gananciaTotal,
            saldoPendienteClientes: Number(saldoClientesAgg._sum?.saldoCuenta ?? 0),
            liquidacionesRealizadas: liquidacionesCount,
            topClientes,
            topProductos,
            tendencia,
        };

        const branding = await getBranding();
        const htmlContent = buildConsigReportHtml(reportData, branding);

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
                "Content-Disposition": `inline; filename="Reporte-Consignacion-${PERIOD_LABELS[period].replace(/\s+/g, "-")}.pdf"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        console.error("PDF CONSIG ERROR:", err);
        return NextResponse.json({ error: "Error generando reporte consignacion" }, { status: 500 });
    } finally {
        try { if (browser) await browser.close(); } catch { }
    }
}

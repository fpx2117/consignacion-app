// src/app/ver/consig/[period]/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import puppeteer, { Browser } from "puppeteer";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveTimezone } from "@/lib/get-configured-tz";
import { prisma } from "@/lib/prisma";
import { getBranding } from "@/lib/reports/get-branding";
import { buildConsigReportHtml, type ConsigReportData, type ConsigClienteRow, type ConsigTopProducto } from "@/lib/reports/base/consignacion-report-template";
import { nowAR, startOfDayAR, startOfWeekAR, startOfMonthAR, formatDateTimeAR } from "@/lib/utils-date";
import { resolveRequestedSucursalId } from "@/lib/sucursalScope";

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
        const requestedSucursalId = Number(searchParams.get("sucursalId") ?? 1);
        const auth = await requireAuth();
        const authUserId = auth.ok ? Number(auth.user.sub) : null;
        const userId = Number.isFinite(authUserId) ? authUserId : null;
        const scopedSucursalId = auth.ok
            ? resolveRequestedSucursalId(auth, requestedSucursalId)
            : 1;
        const isGlobal = scopedSucursalId === 0;

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const timezone = await resolveTimezone({ userId, sucursalId: scopedSucursalId });
        const tz = timezone.tz;
        const start = getPeriodStart(period, tz);
        const dateWhere = start ? { gte: start } : undefined;
        const sucursalWhere = isGlobal ? {} : { sucursalId: scopedSucursalId };

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
                where: {
                    ...sucursalWhere,
                    ...(dateWhere ? { fecha: dateWhere } : {})
                },
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
            prisma.stockSucursal.aggregate({ where: sucursalWhere, _sum: { stockConsignadoUnits: true } }),

            // Saldo pendiente clientes
            prisma.cliente.aggregate({ where: sucursalWhere, _sum: { saldoCuenta: true } }),

            // Cantidad de liquidaciones en período
            prisma.liquidacion.count({
                where: {
                    fecha: dateWhere,
                    consignacion: sucursalWhere
                }
            }),

            // Items liquidados para ganancia
            prisma.liquidacionItem.findMany({
                where: {
                    liquidacion: {
                        fecha: dateWhere,
                        consignacion: sucursalWhere
                    }
                },
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

            // Unidades pendientes (consiguiendo ABIERTAS)
            prisma.consignacionDetalle.findMany({
                where: {
                    consignacion: {
                        ...sucursalWhere,
                        estado: "ABIERTA"
                    }
                },
                select: { unitsEntregadas: true, unitsVendidasAcum: true, unitsDevueltasAcum: true },
            }),

            // Tendencia: nuevas consignaciones por día
            period !== "all"
                ? prisma.consignacion.groupBy({
                    by: ["fecha"],
                    where: { ...sucursalWhere, fecha: dateWhere },
                    _count: { _all: true },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),

            // Tendencia: liquidaciones por día
            period !== "all"
                ? prisma.liquidacion.groupBy({
                    by: ["fecha"],
                    where: {
                        fecha: dateWhere,
                        consignacion: sucursalWhere
                    },
                    _count: { _all: true },
                    orderBy: { fecha: "asc" },
                })
                : Promise.resolve([]),
        ]);

        // ── Cálculo de ganancia total por liquidaciones
        let gananciaTotal = 0;
        for (const item of liquidacionItems) {
            const precioVenta = Number(item.precioUnitario);
            const descuento = Number(item.descuento || 0);
            const costo = Number(item.detalle?.producto?.precioCosto || 0) * item.unitsVendidas;
            gananciaTotal += (precioVenta * item.unitsVendidas - descuento - costo);
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
                    const pVenta = Number(item.precioUnitario);
                    const desc = Number(item.descuento || 0);
                    const costoTotal = Number(item.detalle?.producto?.precioCosto || 0) * item.unitsVendidas;

                    gananciaCliente += (pVenta * item.unitsVendidas - desc - costoTotal);
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
            for (const d of c.detalles) {
                const key = d.producto?.nombre ?? "Desconocido";
                const prev = productoMap.get(key) ?? { unitsEntregadas: 0, unitsVendidas: 0, ganancia: 0 };
                prev.unitsEntregadas += d.unitsEntregadas;
                prev.unitsVendidas += d.unitsVendidasAcum;

                // Calculamos ganancia acumulada para este producto en esta consignacion
                let gAcum = 0;
                for (const liqItem of d.liquidacionItems) {
                    const pVenta = Number(liqItem.precioUnitario);
                    const desc = Number(liqItem.descuento || 0);
                    const cost = Number(d.producto?.precioCosto || 0) * liqItem.unitsVendidas;
                    gAcum += (pVenta * liqItem.unitsVendidas - desc - cost);
                }
                prev.ganancia += gAcum;
                productoMap.set(key, prev);
            }
        }

        const topProductos: ConsigTopProducto[] = [...productoMap.entries()]
            .map(([nombre, v]) => ({ nombre, ...v }))
            .sort((a, b) => b.unitsVendidas - a.unitsVendidas)
            .slice(0, 5);


        // ── Tendencia ganancia per day
        const gananciaByDate = new Map<string, number>();
        if (period !== "all") {
            const liquidacionDetalleRaw = await prisma.liquidacionItem.findMany({
                where: {
                    liquidacion: {
                        fecha: dateWhere,
                        consignacion: sucursalWhere
                    }
                },
                select: {
                    unitsVendidas: true,
                    precioUnitario: true,
                    descuento: true,
                    detalle: {
                        select: {
                            producto: { select: { precioCosto: true } },
                        },
                    },
                    liquidacion: { select: { fecha: true } },
                },
            });
            for (const item of liquidacionDetalleRaw) {
                const key = new Date(item.liquidacion.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });
                const pVenta = Number(item.precioUnitario);
                const desc = Number(item.descuento || 0);
                const cost = Number(item.detalle?.producto?.precioCosto || 0) * item.unitsVendidas;
                const g = (pVenta * item.unitsVendidas - desc - cost);
                gananciaByDate.set(key, (gananciaByDate.get(key) ?? 0) + g);
            }
        }

        // Merge tendencia arrays
        const allDatesSet = new Set<string>();
        const tendenciaConsigMap = new Map<string, number>();
        const tendenciaLiqMap = new Map<string, number>();

        if (Array.isArray(tendenciaConsig)) {
            for (const t of tendenciaConsig) {
                const k = new Date(t.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });
                tendenciaConsigMap.set(k, t._count._all);
                allDatesSet.add(k);
            }
        }
        if (Array.isArray(tendenciaLiquidaciones)) {
            for (const t of tendenciaLiquidaciones) {
                const k = new Date(t.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: tz });
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
            fechaGeneracion: formatDateTimeAR(new Date(), true, tz),
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

        const branding = await getBranding(isGlobal ? (timezone.sucursalId ?? undefined) : scopedSucursalId);
        const htmlContent = buildConsigReportHtml(reportData, branding);

        browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: "domcontentloaded" });
        await page.emulateMediaType("print");
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

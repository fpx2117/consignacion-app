/* eslint-disable */
// @ts-nocheck
"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Package, Wallet, FileText, ArrowRight, Receipt } from "lucide-react";
import type { Consignacion, Pago, Venta } from "@/lib/types";

// Helpers
const formatDate = (dateStr: string | Date) => new Date(dateStr).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const formatCurrency = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(val);

interface HistoryProps {
    consignaciones: Consignacion[];
    pagos: Pago[];
    ventas: Venta[];
}

export function ClientHistoryTabs({ consignaciones, pagos, ventas }: HistoryProps) {

    // Función auxiliar para verificar estado sin errores de TS
    const isAbierta = (estado: any) => {
        return String(estado).toLowerCase() === 'abierta' || String(estado).toLowerCase() === 'activa';
    };

    return (
        <Tabs defaultValue="consignaciones" className="w-full space-y-4 md:space-y-6">
            {/* Navegación Pestañas (Scrollable en Mobile) */}
            <div className="overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                <TabsList className="inline-flex h-11 items-center justify-start rounded-xl bg-muted/50 p-1 text-muted-foreground w-full sm:w-auto">
                    <TabsTrigger value="consignaciones" className="gap-2 px-4 rounded-lg flex-1 sm:flex-none">
                        <Package className="h-4 w-4" /> Consignaciones
                    </TabsTrigger>
                    <TabsTrigger value="liquidaciones" className="gap-2 px-4 rounded-lg flex-1 sm:flex-none">
                        <Wallet className="h-4 w-4" /> Pagos
                    </TabsTrigger>
                    <TabsTrigger value="facturas" className="gap-2 px-4 rounded-lg flex-1 sm:flex-none">
                        <FileText className="h-4 w-4" /> Ventas
                    </TabsTrigger>
                </TabsList>
            </div>

            <Separator className="hidden md:block" />

            {/* --- CONTENIDO CONSIGNACIONES --- */}
            <TabsContent value="consignaciones" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {consignaciones.length === 0 ? (
                    <EmptyState icon={Package} title="Sin consignaciones" text="No hay registros para este cliente." />
                ) : (
                    <>
                        {/* VISTA MOBILE (Tarjetas) */}
                        <div className="grid gap-3 md:hidden">
                            {consignaciones.map(c => (
                                <MobileCard key={c.id}
                                    title={`Consignación #${c.id}`}
                                    date={c.fecha}
                                    status={c.estado}
                                    // ✅ CORRECCIÓN: Usamos la función auxiliar
                                    statusColor={isAbierta(c.estado) ? 'default' : 'secondary'}
                                    link={`/consignaciones?id=${c.id}`}
                                />
                            ))}
                        </div>
                        {/* VISTA DESKTOP (Tabla) */}
                        <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/40"><TableRow><TableHead>Fecha</TableHead><TableHead>ID</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {consignaciones.map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell>{formatDate(c.fecha)}</TableCell>
                                            <TableCell className="text-xs font-mono">#{c.id}</TableCell>
                                            <TableCell>
                                                {/* ✅ CORRECCIÓN: Usamos la función auxiliar */}
                                                <Badge variant={isAbierta(c.estado) ? 'default' : 'secondary'}>
                                                    {c.estado}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right"><Button size="sm" variant="outline" asChild><Link href={`/consignaciones?id=${c.id}`}>Ver</Link></Button></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </TabsContent>

            {/* --- CONTENIDO PAGOS --- */}
            <TabsContent value="liquidaciones" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {pagos.length === 0 ? (
                    <EmptyState icon={Wallet} title="Sin pagos" text="No hay historial de cobros." />
                ) : (
                    <>
                        {/* MOBILE */}
                        <div className="grid gap-3 md:hidden">
                            {pagos.map((p: any) => (
                                <MobileCard key={p.id}
                                    title="Pago Recibido"
                                    date={p.fecha}
                                    amount={p.monto}
                                    subtitle={(p as any).metodoPago || "Efectivo"}
                                />
                            ))}
                        </div>
                        {/* DESKTOP */}
                        <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/40"><TableRow><TableHead>Fecha</TableHead><TableHead>Método</TableHead><TableHead className="text-right">Monto</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {pagos.map((p: any) => (
                                        <TableRow key={p.id}>
                                            <TableCell>{formatDate(p.fecha)}</TableCell>
                                            <TableCell className="capitalize flex items-center gap-2"><Receipt className="h-3 w-3" /> {(p as any).metodoPago || "Efectivo"}</TableCell>
                                            <TableCell className="text-right font-bold text-emerald-600">+ {formatCurrency(p.monto)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </TabsContent>

            {/* --- CONTENIDO VENTAS --- */}
            <TabsContent value="facturas" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {ventas.length === 0 ? (
                    <EmptyState icon={FileText} title="Sin ventas" text="No hay ventas directas." />
                ) : (
                    <>
                        {/* MOBILE */}
                        <div className="grid gap-3 md:hidden">
                            {ventas.map(v => (
                                <MobileCard key={v.id}
                                    title={`Ticket #${v.id}`}
                                    date={v.fecha}
                                    amount={v.total}
                                    subtitle={`${(v as any).cantidadTotal ?? "-"} artículos`}
                                />
                            ))}
                        </div>
                        {/* DESKTOP */}
                        <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/40"><TableRow><TableHead>Fecha</TableHead><TableHead>Ticket</TableHead><TableHead>Items</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {ventas.map(v => (
                                        <TableRow key={v.id}>
                                            <TableCell>{formatDate(v.fecha)}</TableCell>
                                            <TableCell className="font-mono text-xs">#{v.id}</TableCell>
                                            <TableCell>{(v as any).cantidadTotal ?? "-"} un.</TableCell>
                                            <TableCell className="text-right font-bold">{formatCurrency(v.total)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </TabsContent>
        </Tabs>
    );
}

// --- SUBCOMPONENTES DE UI ---

function MobileCard({ title, date, status, statusColor, amount, subtitle, link }: any) {
    const Content = () => (
        <div className="flex items-center justify-between p-4">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{title}</span>
                    {status && <Badge variant={statusColor} className="text-[10px] px-1.5 h-5">{status}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(date)} • {subtitle || "Sin detalle"}</p>
            </div>
            <div className="text-right">
                {amount !== undefined && (
                    <span className="block font-bold text-emerald-600">{formatCurrency(amount)}</span>
                )}
                {link && <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto mt-1" />}
            </div>
        </div>
    );

    if (link) {
        return <Link href={link}><Card className="active:scale-[0.98] transition-transform"><Content /></Card></Link>;
    }
    return <Card><Content /></Card>;
}

function EmptyState({ icon: Icon, title, text }: any) {
    return (
        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-muted-foreground/10 rounded-xl bg-muted/5 text-center">
            <div className="p-3 bg-background rounded-full mb-3 shadow-sm border"><Icon className="h-5 w-5 text-muted-foreground" /></div>
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{text}</p>
        </div>
    );
}
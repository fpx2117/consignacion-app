"use client";

import * as React from "react";
import Link from "next/link"; // Importante: Asegurate de tener esto para el botón de volver
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Icons
import {
  Palette,
  Save,
  Loader2,
  RefreshCw,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Scan,
  FileText,
  ChevronLeft, // Agregado para el botón de volver
} from "lucide-react";

// Report template (preview real)
import {
  buildVentaHtml,
  type VentaReportDTO,
} from "@/lib/reports/base/venta-report-template";
import type { BrandingDTO } from "@/lib/reports/get-branding";

type BrandingFormDTO = Omit<BrandingDTO, "logoUrl"> & {
  logoUrl?: string | null;
};

export default function BrandingPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [deletingLogo, setDeletingLogo] = React.useState(false);

  const [form, setForm] = React.useState<BrandingFormDTO>({
    businessName: "",
    primaryColor: "#294c98",
    footerText: null,
    phone: null,
    address: null,
    logoUrl: null,
  });

  // ✅ estable SSR/CSR
  const [logoVersion, setLogoVersion] = React.useState<number>(0);
  const logoSrc = React.useMemo(
    () => `/api/settings/branding/logo?v=${logoVersion}`,
    [logoVersion]
  );

  const [hasLogo, setHasLogo] = React.useState(true);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const bumpLogo = React.useCallback(() => {
    setLogoVersion(Date.now());
    setHasLogo(true);
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/branding", { cache: "no-store" });
      const data = await res.json();
      const b = data?.branding ?? data;

      setForm({
        businessName: b?.businessName ?? "",
        primaryColor: b?.primaryColor ?? "#294c98",
        footerText: b?.footerText ?? null,
        phone: b?.phone ?? null,
        address: b?.address ?? null,
        logoUrl: null,
      });

      bumpLogo();
    } catch {
      toast.error("Error cargando branding");
    } finally {
      setLoading(false);
    }
  }, [bumpLogo]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: form.businessName,
          primaryColor: form.primaryColor,
          footerText: form.footerText || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      });

      if (!res.ok) throw new Error("No se pudo guardar");
      toast.success("Branding guardado");
    } catch (e: any) {
      toast.error(e?.message || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/settings/branding/logo/upload", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || "No se pudo subir el logo");

      toast.success("Logo actualizado");
      bumpLogo();

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message || "Error subiendo logo");
    } finally {
      setUploading(false);
    }
  }

  async function onDeleteLogo() {
    setDeletingLogo(true);
    try {
      const res = await fetch("/api/settings/branding/logo", { method: "DELETE" });
      const json = await res.json();

      if (!res.ok || !json?.ok) throw new Error(json?.error || "No se pudo eliminar el logo");

      toast.success("Logo eliminado");
      setHasLogo(false);
      setLogoVersion(Date.now());

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      toast.error(e?.message || "Error eliminando logo");
    } finally {
      setDeletingLogo(false);
    }
  }

  // ---- Preview: template real ----
  const mockVenta: VentaReportDTO = React.useMemo(
    () => ({
      id: 37,
      fecha: new Date(),
      total: 28500,
      metodoPago: "Efectivo",
      clienteNombre: "Juan Pérez",
      clienteTelefono: "+54 351 555-1234",
      items: [
        { producto: "Sky Vodka Raspberry", cantidad: 1, precioUnitario: 12000, subtotal: 12000 },
        { producto: "Speeds XL", cantidad: 2, precioUnitario: 4500, subtotal: 9000 },
      ],
    }),
    []
  );

  const [clientBaseUrl, setClientBaseUrl] = React.useState<string>("");
  React.useEffect(() => {
    setClientBaseUrl(window.location.origin);
  }, []);

  const previewHtml = React.useMemo(() => {
    const brandingForPreview: BrandingDTO = {
      businessName: form.businessName || "Consignación",
      primaryColor: form.primaryColor || "#294c98",
      footerText: form.footerText ?? null,
      phone: form.phone ?? null,
      address: form.address ?? null,
      logoUrl: hasLogo && clientBaseUrl ? `${clientBaseUrl}${logoSrc}` : null,
    };

    return buildVentaHtml(mockVenta, brandingForPreview);
  }, [form, hasLogo, clientBaseUrl, logoSrc, mockVenta]);

  const canRenderPreview = !loading && !!clientBaseUrl;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-10 text-foreground selection:bg-primary/20">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        {/* MODIFICADO: Agregado el botón de "Volver" y organizado igual que Usuarios */}
        <div className="space-y-3">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver a Configuración
          </Link>
          <div className="flex items-center gap-2 text-primary font-semibold tracking-wider uppercase text-[10px] bg-primary/10 w-fit px-3 py-1 rounded-full border border-primary/20">
            <Palette className="h-3 w-3" />
            Personalización
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent pb-2">
            Branding
          </h1>
          <p className="text-sm text-muted-foreground">
            Configurá el header/footer y el logo que se verán en reportes y PDFs.
          </p>
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3">
          <Button
            size="lg"
            onClick={onSave}
            disabled={saving || loading}
            className="rounded-2xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300 font-bold gap-3 px-8 h-12 text-base w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Save className="h-5 w-5 stroke-[2.5px]" />
                Guardar cambios
              </>
            )}
          </Button>

          <Button
            variant="secondary"
            size="lg"
            onClick={load}
            disabled={loading}
            className="rounded-2xl font-bold gap-2 h-12 w-full sm:w-auto bg-muted/80 hover:bg-muted"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Recargar
          </Button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT: FORM */}
        <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="text-sm font-black tracking-tight text-foreground">Configuración</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Estos datos se verán en el header/footer de los reportes.
            </p>

            {loading ? (
              <div className="h-[340px] flex flex-col items-center justify-center gap-4 opacity-70">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground animate-pulse">
                  Cargando…
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {/* LOGO */}
                <div className="grid gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    Logo
                  </span>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-full sm:w-36 h-28 rounded-2xl border border-border/50 bg-muted/20 grid place-items-center overflow-hidden relative">
                      {hasLogo ? (
                        <img
                          key={logoSrc}
                          src={logoSrc}
                          alt="Logo"
                          className="max-h-20 max-w-[85%] object-contain"
                          onError={() => setHasLogo(false)}
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground/60 flex items-center gap-2">
                          <span className="h-8 w-8 rounded-xl bg-muted/70 border border-border/50 grid place-items-center font-black text-[10px]">
                            LOGO
                          </span>
                          Sin logo
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 w-full">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        disabled={uploading || deletingLogo}
                        className={cn(
                          "block w-full text-sm text-foreground",
                          "file:mr-3 file:rounded-xl file:border file:border-border/60",
                          "file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:tracking-widest",
                          "file:bg-background/60 file:text-foreground hover:file:bg-muted/80",
                          "dark:file:bg-muted/40 dark:file:text-foreground dark:hover:file:bg-muted/70",
                          "disabled:opacity-60"
                        )}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUploadLogo(f);
                        }}
                      />

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          PNG/JPG/WEBP. Recomendado 512px, liviano.
                        </p>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={deletingLogo}
                              className={cn(
                                "rounded-xl font-black text-[11px] gap-2",
                                "text-red-600 hover:text-white hover:bg-red-600/90"
                              )}
                            >
                              {deletingLogo ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>

                          <AlertDialogContent className="rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar el logo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se restaurará el logo por defecto (badge). Podés subir uno nuevo cuando quieras.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={onDeleteLogo}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
                              >
                                Sí, eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>

                      {uploading && (
                        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                          Subiendo…
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <Field label="Nombre del negocio">
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/40 backdrop-blur px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.businessName}
                    onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                    placeholder="Ej: Consignación"
                  />
                </Field>

                <Field label="Teléfono">
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/40 backdrop-blur px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.phone ?? ""}
                    onChange={(e) => setForm({ ...form, phone: e.target.value || null })}
                    placeholder="Ej: +54 351 123 4567"
                  />
                </Field>

                <Field label="Dirección">
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/40 backdrop-blur px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.address ?? ""}
                    onChange={(e) => setForm({ ...form, address: e.target.value || null })}
                    placeholder="Ej: Av. Siempreviva 742"
                  />
                </Field>
              </div>
            )}
          </div>
        </Card>

        {/* RIGHT: PREVIEW (click -> fullscreen zoom) */}
        <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="text-sm font-black tracking-tight text-foreground">Vista previa</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Tocá/click en el reporte para abrirlo en visor y hacer zoom.
            </p>

            {!canRenderPreview ? (
              <div className="mt-6 h-[520px] grid place-items-center rounded-3xl border border-border/50 bg-card/30">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-60" />
              </div>
            ) : (
              <PdfLikePreview html={previewHtml} />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
function PdfLikePreview({ html }: { html: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="mt-6">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full text-left group",
              "rounded-3xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden",
              "hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 transition-all"
            )}
          >
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Ticket de Venta (A4)
              </div>
              <div className="text-[10px] font-bold text-muted-foreground/70 flex items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                Abrir visor
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <A4ScaledFrame html={html} heightPx={520} />
            </div>
          </button>
        </DialogTrigger>

        {/* FIX: [&>button]:hidden oculta la 'X' nativa del Dialog para que solo quede nuestro botón "Cerrar" */}
        <DialogContent className="max-w-[98vw] w-[98vw] h-[92vh] p-0 rounded-2xl overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur flex-row items-center justify-between flex shrink-0">
            <DialogTitle className="text-sm font-black flex items-center gap-2">
              <Scan className="h-4 w-4" />
              Visor de Reporte
            </DialogTitle>

            <Button variant="secondary" size="sm" className="rounded-xl gap-2" onClick={() => setOpen(false)}>
              <Minimize2 className="h-4 w-4" />
              Cerrar
            </Button>
          </DialogHeader>

          <FullViewer html={html} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Frame A4 que se escala al ancho disponible (Mini vista previa) */
function A4ScaledFrame({ html, heightPx }: { html: string; heightPx: number }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);

  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  const recalc = React.useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const padding = 0;
    const available = el.clientWidth - padding * 2;
    const next = Math.min(1, Math.max(0.22, available / A4_WIDTH));
    setScale(next);
  }, []);

  React.useEffect(() => {
    recalc();
    const ro = new ResizeObserver(() => recalc());
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [recalc]);

  const canvasH = Math.min(heightPx, A4_HEIGHT * scale);

  return (
    <div ref={containerRef} className="w-full overflow-hidden">
      <div className="mx-auto" style={{ width: A4_WIDTH * scale, height: canvasH }}>
        <div
          className="bg-white rounded-xl shadow-2xl border border-border/40 overflow-hidden"
          style={{
            width: A4_WIDTH,
            height: A4_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <iframe
            title="Preview A4"
            srcDoc={html}
            className="w-full h-full"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}

/** Full viewer con zoom controls y Drag to Pan (Estructura de Lienzo Definitiva) */
function FullViewer({ html }: { html: string }) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;

  const [zoom, setZoom] = React.useState(1);
  const [isDragging, setIsDragging] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0, x: 0, y: 0 });

  const clamp = (v: number) => Math.min(3.5, Math.max(0.2, v));

  const fitWidth = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const availableW = el.clientWidth - 32; 
    setZoom(clamp(availableW / A4_WIDTH));
  }, []);

  const fitPage = React.useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const availableW = el.clientWidth - 32;
    const availableH = el.clientHeight - 32;
    const byW = availableW / A4_WIDTH;
    const byH = availableH / A4_HEIGHT;
    setZoom(clamp(Math.min(byW, byH)));
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => fitPage(), 50);
    const handleResize = () => fitPage();
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [fitPage]);

  // --- Lógica de Arrastre (Drag to Pan) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!viewportRef.current) return;
    setIsDragging(true);
    setPos({
      left: viewportRef.current.scrollLeft,
      top: viewportRef.current.scrollTop,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !viewportRef.current) return;
    e.preventDefault();
    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;
    viewportRef.current.scrollTop = pos.top - dy;
    viewportRef.current.scrollLeft = pos.left - dx;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Toolbar: shrink-0 asegura que jamás se encoja o desaparezca */}
      <div className="px-4 py-3 border-b border-border/50 bg-background/90 backdrop-blur flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl gap-2"
            onClick={() => setZoom((z) => clamp(z - 0.1))}
          >
            <ZoomOut className="h-4 w-4" />
            <span className="hidden sm:inline">-</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-xl gap-2"
            onClick={() => setZoom((z) => clamp(z + 0.1))}
          >
            <ZoomIn className="h-4 w-4" />
            <span className="hidden sm:inline">+</span>
          </Button>

          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground tabular-nums ml-2">
            Zoom {Math.round(zoom * 100)}%
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="rounded-xl" onClick={fitWidth}>
            <span className="hidden sm:inline">Ajustar ancho</span>
            <span className="sm:hidden">Ancho</span>
          </Button>
          <Button variant="secondary" size="sm" className="rounded-xl" onClick={fitPage}>
            <span className="hidden sm:inline">Ajustar página</span>
            <span className="sm:hidden">Página</span>
          </Button>
        </div>
      </div>

      {/* Viewport de Scroll */}
      <div
        ref={viewportRef}
        className={cn(
          "flex-1 overflow-auto bg-muted/20 p-4 min-h-0 select-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Contenedor Mágico: Usa margin: 0 auto. */}
        <div
          className="relative transition-all duration-200"
          style={{
            width: A4_WIDTH * zoom,
            height: A4_HEIGHT * zoom,
            margin: "0 auto",
          }}
        >
          <div
            className="absolute top-0 left-0 bg-white rounded-xl shadow-2xl border border-border/40 overflow-hidden origin-top-left"
            style={{
              width: A4_WIDTH,
              height: A4_HEIGHT,
              transform: `scale(${zoom})`,
            }}
          >
            <iframe
              title="Viewer A4"
              srcDoc={html}
              className="w-full h-full pointer-events-none bg-white"
              sandbox="allow-same-origin allow-scripts"
            />
            <div className="absolute inset-0 z-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      {children}
    </label>
  );
}
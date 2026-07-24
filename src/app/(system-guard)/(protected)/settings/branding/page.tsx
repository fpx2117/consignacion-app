"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

// UI
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Scan,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { TutorialButton } from "@/components/ui/tutorial-button";
import { BRANDING_TUTORIAL } from "@/lib/tutorial-content";

// Report template (preview real)
import {
  buildVentaHtml,
  type VentaReportDTO,
} from "@/lib/reports/base/venta-report-template";
import type { BrandingDTO } from "@/lib/reports/types";

type BrandingFormDTO = Omit<BrandingDTO, "logoUrl" | "logoBase64"> & {
  logoUrl?: string | null;
  logoBase64?: string | null;
};

const getTokenColor = (token: string) => {
  if (typeof window === "undefined") return "hsl(var(--primary))";
  return (
    getComputedStyle(document.documentElement).getPropertyValue(token).trim() ||
    "hsl(var(--primary))"
  );
};

export default function BrandingPage() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [deletingLogo, setDeletingLogo] = React.useState(false);

  const [form, setForm] = React.useState<BrandingFormDTO>({
    businessName: "",
    primaryColor: "hsl(var(--primary))",
    footerText: null,
    phone: null,
    address: null,
    logoUrl: null,
  });

  const [logoVersion, setLogoVersion] = React.useState<number>(0);
  const logoSrc = React.useMemo(
    () => `/api/settings/branding/logo?v=${logoVersion}`,
    [logoVersion],
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
        primaryColor:
          b?.primaryColor ?? getTokenColor("--brand-default-primary"),
        footerText: b?.footerText ?? null,
        phone: b?.phone ?? null,
        address: b?.address ?? null,
        logoUrl: null,
        logoBase64: null,
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

      if (!res.ok) throw new Error("No se pudo guardar branding");

      toast.success("Branding actualizado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error guardando");
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
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "No se pudo subir el logo");
      toast.success("Logo actualizado");
      bumpLogo();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error subiendo logo");
    } finally {
      setUploading(false);
    }
  }

  async function onDeleteLogo() {
    setDeletingLogo(true);
    try {
      const res = await fetch("/api/settings/branding/logo", {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok)
        throw new Error(json?.error || "No se pudo eliminar el logo");
      toast.success("Logo eliminado");
      setHasLogo(false);
      setLogoVersion(Date.now());
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error eliminando logo");
    } finally {
      setDeletingLogo(false);
    }
  }

  const mockVenta: VentaReportDTO = React.useMemo(
    () => ({
      id: 37,
      fecha: new Date(),
      total: 28500,
      metodoPago: "Efectivo",
      clienteNombre: "Juan Pérez",
      clienteTelefono: "+54 351 555-1234",
      zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      items: [
        {
          producto: "Sky Vodka Raspberry",
          cantidad: 1,
          precioUnitario: 12000,
          descuento: 0,
          subtotal: 12000,
        },
        {
          producto: "Speeds XL",
          cantidad: 2,
          precioUnitario: 4500,
          descuento: 0,
          subtotal: 9000,
        },
      ],
    }),
    [],
  );

  const [clientBaseUrl, setClientBaseUrl] = React.useState<string>("");
  React.useEffect(() => {
    setClientBaseUrl(window.location.origin);
  }, []);

  const previewHtml = React.useMemo(() => {
    const brandingForPreview: BrandingDTO = {
      businessName: form.businessName || "Consignación",
      primaryColor:
        form.primaryColor || getTokenColor("--brand-default-primary"),
      footerText: form.footerText ?? null,
      phone: form.phone ?? null,
      address: form.address ?? null,
      logoUrl: hasLogo && clientBaseUrl ? `${clientBaseUrl}${logoSrc}` : null,
      logoBase64: null,
    };
    return buildVentaHtml(mockVenta, brandingForPreview);
  }, [form, hasLogo, clientBaseUrl, logoSrc, mockVenta]);

  const canRenderPreview = !loading && !!clientBaseUrl;

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-10 text-foreground selection:bg-primary/20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
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
            Branding
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent pb-2">
            Ticket PDF
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Personalizá la identidad visual de tus reportes imprimibles.
            </p>
            <TutorialButton steps={BRANDING_TUTORIAL} />
          </div>
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
                <Loader2 className="h-5 w-5 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                <Save className="h-5 w-5 stroke-[2.5px]" /> Guardar cambios
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
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}{" "}
            Recargar
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CONFIGURACIÓN BÁSICA */}
        <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="text-sm font-black tracking-tight text-foreground">
              Identidad Visual
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Estos datos aparecen en el encabezado del ticket.
            </p>

            {loading ? (
              <div className="h-[340px] flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                <div className="grid gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                    Logo del Negocio
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="w-full sm:w-40 h-32 rounded-2xl border border-border/50 bg-muted/20 grid place-items-center overflow-hidden relative">
                      {hasLogo && logoSrc ? (
                        <Image
                          key={logoSrc}
                          src={logoSrc}
                          alt="Logo"
                          fill
                          unoptimized
                          sizes="160px"
                          className="object-contain p-3"
                          onError={() => setHasLogo(false)}
                        />
                      ) : (
                        <span className="text-[10px] font-black text-muted-foreground/60">
                          SIN LOGO
                        </span>
                      )}
                    </div>
                    <div className="grid gap-3 w-full">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        className="block w-full text-xs text-foreground file:mr-3 file:rounded-xl file:border file:border-border/60 file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:bg-background/60 hover:file:bg-muted/80 cursor-pointer"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onUploadLogo(f);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onDeleteLogo}
                        disabled={deletingLogo}
                        className="w-fit h-8 text-[color:var(--status-danger)] hover:text-[color:var(--ui-fx-white)] hover:bg-[color:var(--status-danger)]/90 rounded-xl text-[10px] font-bold px-4"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar logo
                      </Button>
                    </div>
                  </div>
                </div>

                <Field label="Nombre del negocio">
                  <input
                    className="w-full rounded-2xl border border-border/50 bg-background/40 px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={form.businessName}
                    onChange={(e) =>
                      setForm({ ...form, businessName: e.target.value })
                    }
                    placeholder="Ej: AllData POS"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Teléfono">
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/40 px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={form.phone ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value || null })
                      }
                      placeholder="Ej: +54 351 123 4567"
                    />
                  </Field>
                  <Field label="Dirección">
                    <input
                      className="w-full rounded-2xl border border-border/50 bg-background/40 px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={form.address ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value || null })
                      }
                      placeholder="Ej: Av. Siempreviva 742"
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* REPORT PREVIEW */}
        <Card className="border-none bg-card/40 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden">
          <div className="p-5 sm:p-6">
            <h2 className="text-sm font-black tracking-tight text-foreground">
              Vista Previa del Reporte
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Así es como tus clientes verán el PDF impreso.
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
            className="w-full text-left rounded-3xl border border-border/50 bg-card/30 overflow-hidden hover:border-primary/30 transition-all group"
          >
            <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Reporte A4 (Simulado)
              </span>
              <Maximize2 className="h-4 w-4 group-hover:scale-110 transition-transform" />
            </div>
            <div className="p-4">
              <A4ScaledFrame html={html} heightPx={500} />
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[92vh] p-0 rounded-2xl overflow-hidden flex flex-col [&>button]:hidden">
          <DialogHeader className="px-4 py-3 border-b border-border/50 bg-background/80 flex shrink-0">
            <div className="flex items-center justify-between w-full">
              <DialogTitle className="text-sm font-black flex items-center gap-2">
                <Scan className="h-4 w-4" /> Visor de Reporte
              </DialogTitle>
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl"
                onClick={() => setOpen(false)}
              >
                Cerrar
              </Button>
            </div>
          </DialogHeader>
          <FullViewer html={html} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function A4ScaledFrame({ html, heightPx }: { html: string; heightPx: number }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);
  const recalc = React.useCallback(() => {
    if (!containerRef.current) return;
    setScale(
      Math.min(1, Math.max(0.1, containerRef.current.clientWidth / 794)),
    );
  }, []);
  React.useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalc]);

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden"
      style={{ height: heightPx }}
    >
      <div
        style={{
          width: 794,
          height: 1123,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        className="bg-card border shadow-sm"
      >
        <iframe title="Preview" srcDoc={html} className="w-full h-full" />
      </div>
    </div>
  );
}

function FullViewer({ html }: { html: string }) {
  const [zoom, setZoom] = React.useState(0.85);
  const clamp = (v: number) => Math.min(3, Math.max(0.2, v));

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      <div className="px-4 py-2 border-b bg-background/90 flex items-center gap-4 shrink-0 justify-center">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => setZoom((z) => clamp(z - 0.1))}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-[11px] font-bold tabular-nums w-12 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => setZoom((z) => clamp(z + 0.1))}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-muted/20 p-8 flex justify-center items-start">
        <div
          style={{ width: 794 * zoom, height: 1123 * zoom }}
          className="bg-card shadow-2xl origin-top-left transition-all duration-200"
        >
          <iframe
            title="Viewer"
            srcDoc={html}
            className="w-full h-full"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: 794,
              height: 1123,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      {children}
    </label>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Eye,
  Loader2,
  Package,
  ShoppingCart,
  Sparkles,
  List,
  Store,
  X,
} from "lucide-react";

import { apiService } from "@/lib/apiService";
import { cn } from "@/lib/utils";
import { useSucursalStore } from "@/store/useSucursalStore";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { WhatsAppHeader } from "./components/WhatsAppHeader";
import { WhatsAppPreview } from "./components/WhatsAppPreview";
import { TemplateEditor } from "./components/TemplateEditor";
import { ProductListGenerator } from "./components/ProductListGenerator";

type TabId = "consignacion" | "venta" | "tienda" | "listaProductos";

const MAGIC_TEMPLATES: Record<Exclude<TabId, "listaProductos">, string[]> = {
  consignacion: [
    "*Notificacion de Consignacion*\n\nHola {name}, te compartimos el detalle de tu consignacion del {date}.\n\nRemito: {url}\nItems: {items}\nTotal estimado: {total}\n\nProductos:\n{productos}\n\nGracias por confiar en nosotros.",
    "Hola {name}. Ya podes revisar tu consignacion cargada el {date}.\n\nLink de consulta: {url}\nCantidad de items: {items}\nMonto estimado: {total}\n\nDetalle:\n{productos}",
    "*Consignacion registrada*\n\nCliente: {name}\nFecha: {date}\nRemito: {url}\nItems: {items}\nTotal estimado: {total}\n\nLista de productos:\n{productos}\n\nAnte cualquier duda, escribinos por este medio.",
  ],
  venta: [
    "*Gracias por tu compra, {name}*\n\nComprobante del {date}\nTicket: {url}\nItems: {items}\nTotal: {total}\n\nProductos:\n{productos}\n\nTe esperamos pronto.",
    "Hola {name}. Este es el resumen de tu compra:\n\nFecha: {date}\nComprobante: {url}\nCantidad: {items}\nMonto final: {total}\n\nDetalle:\n{productos}",
    "*Ticket Digital*\n\nCliente: {name}\nFecha: {date}\nLink: {url}\nItems: {items}\nTotal final: {total}\n\nLista de productos:\n{productos}",
  ],
  tienda: [
    "Hola. Estoy interesado en *{nombre_producto}*. Me compartis precio y disponibilidad?",
    "Hola, vi *{nombre_producto}* en la tienda y quiero avanzar con la compra.",
    "Buenas. Quiero consultar por *{nombre_producto}* y opciones de envio.",
  ],
};

const SMART_VARIABLES = [
  { label: "Nombre Cliente", value: "{name}" },
  { label: "Link del Ticket/Remito", value: "{url}" },
  { label: "Total", value: "{total}" },
  { label: "Cantidad de Items", value: "{items}" },
  { label: "Lista de Productos", value: "{productos}" },
  { label: "Fecha", value: "{date}" },
];

const TAB_ITEMS: Array<{
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "consignacion",
    label: "Consignacion",
    shortLabel: "Consig.",
    icon: Package,
  },
  { id: "venta", label: "Venta POS", shortLabel: "Venta", icon: ShoppingCart },
  { id: "tienda", label: "Tienda Online", shortLabel: "Tienda", icon: Store },
  {
    id: "listaProductos",
    label: "Lista Productos",
    shortLabel: "Lista",
    icon: List,
  },
];

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/60 relative overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

export default function WhatsAppSettingsPage() {
  const activeSucursalId = useSucursalStore((state) => state.activeSucursalId);

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<TabId>("consignacion");
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [portalReady, setPortalReady] = React.useState(false);

  const [templateConsignacion, setTemplateConsignacion] = React.useState("");
  const [templateVenta, setTemplateVenta] = React.useState("");
  const [templateTienda, setTemplateTienda] = React.useState("");
  const [templateListaProductos, setTemplateListaProductos] =
    React.useState("");
  const [whatsappNumber, setWhatsappNumber] = React.useState("");
  const [businessName, setBusinessName] = React.useState("Tu Negocio");

  React.useEffect(() => {
    setPortalReady(true);
  }, []);

  React.useEffect(() => {
    if (!previewOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewOpen]);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [config, branding] = await Promise.all([
          apiService.getConfiguracionGeneral(),
          apiService.getBranding(),
        ]);

        setTemplateConsignacion(config?.mensajeWhatsappConsignacion || "");
        setTemplateVenta(config?.mensajeWhatsappVenta || "");
        setTemplateTienda(branding?.whatsappMessage || "");
        setWhatsappNumber(branding?.whatsappNumber || "");
        setBusinessName(branding?.businessName || "Tu Negocio");
        setIsDirty(false);
      } catch {
        toast.error("Error al cargar configuracion de WhatsApp");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [activeSucursalId]);

  const updateTemplateConsignacion = React.useCallback((value: string) => {
    setTemplateConsignacion(value);
    setIsDirty(true);
  }, []);

  const updateTemplateVenta = React.useCallback((value: string) => {
    setTemplateVenta(value);
    setIsDirty(true);
  }, []);

  const updateTemplateTienda = React.useCallback((value: string) => {
    setTemplateTienda(value);
    setIsDirty(true);
  }, []);

  const updateWhatsappNumber = React.useCallback((value: string) => {
    setWhatsappNumber(value);
    setIsDirty(true);
  }, []);

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await Promise.all([
        apiService.actualizarConfiguracionGeneral({
          mensajeWhatsappConsignacion: templateConsignacion,
          mensajeWhatsappVenta: templateVenta,
        }),
        apiService.actualizarBranding({
          whatsappMessage: templateTienda,
          whatsappNumber,
        }),
      ]);

      setIsDirty(false);
      toast.success("Configuracion de WhatsApp guardada");
    } catch {
      toast.error("Error al guardar cambios");
    } finally {
      setSaving(false);
    }
  }, [templateConsignacion, templateVenta, templateTienda, whatsappNumber]);

  const generateMagicMessage = React.useCallback(
    (type: Exclude<TabId, "listaProductos">) => {
      const templates = MAGIC_TEMPLATES[type];
      const randomTemplate =
        templates[Math.floor(Math.random() * templates.length)];

      if (type === "consignacion") updateTemplateConsignacion(randomTemplate);
      if (type === "venta") updateTemplateVenta(randomTemplate);
      if (type === "tienda") updateTemplateTienda(randomTemplate);

      toast.success("Mensaje sugerido aplicado", {
        icon: (
          <Sparkles className="h-4 w-4 text-[color:var(--status-warning)]" />
        ),
      });
    },
    [updateTemplateConsignacion, updateTemplateTienda, updateTemplateVenta],
  );

  const getPreviewText = React.useCallback(() => {
    let raw = "";
    if (activeTab === "consignacion")
      raw = templateConsignacion || "*Remito*\n\nHola {name}.\nRemito: {url}";
    if (activeTab === "venta")
      raw =
        templateVenta ||
        "*Ticket*\n\nHola {name}, gracias por tu compra.\nTicket: {url}";
    if (activeTab === "tienda")
      raw =
        templateTienda ||
        "Hola. Vi el producto *{nombre_producto}* y me gustaria pedirlo.";
    if (activeTab === "listaProductos")
      raw =
        templateListaProductos || "Genera la lista para ver la vista previa.";

    return raw
      .replace(/{name}/g, "Juan Perez")
      .replace(/{url}/g, "https://alldata.pos/t/123xyz")
      .replace(/{total}/g, "$150.000")
      .replace(/{items}/g, "3")
      .replace(/{productos}/g, "1 - Producto X\n2 - Producto Y")
      .replace(/{date}/g, new Date().toLocaleDateString("es-AR"))
      .replace(/{nombre_producto}/g, "Producto de ejemplo");
  }, [
    activeTab,
    templateConsignacion,
    templateListaProductos,
    templateTienda,
    templateVenta,
  ]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-5">
        <style jsx global>{`
          @keyframes shimmer {
            100% {
              transform: translateX(100%);
            }
          }
        `}</style>
        <SkeletonBlock className="h-40 w-full rounded-3xl" />
        <SkeletonBlock className="h-11 w-full max-w-2xl" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <SkeletonBlock className="h-[520px] xl:col-span-7" />
          <SkeletonBlock className="h-[520px] xl:col-span-5" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-3 sm:p-4 md:p-8 pb-24 animate-in fade-in duration-300">
      <WhatsAppHeader onSave={handleSave} saving={saving} />

      <Card className="rounded-2xl border-border/60 bg-card/70 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              Experiencia de mensajes por canal
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Personaliza consignacion, ventas y tienda online. Todo optimizado
              para celular, tablet y desktop.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="text-xs font-semibold text-[color:var(--status-warning)]">
                Cambios sin guardar
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg lg:hidden"
              onClick={() => setPreviewOpen(true)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
            </Button>
            <Button
              size="sm"
              className="h-8 rounded-lg"
              onClick={() => void handleSave()}
              disabled={saving || !isDirty}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Guardar"
              )}
            </Button>
          </div>
        </div>
      </Card>

      <div className="-mx-1 px-1">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-start">
        <section className="xl:col-span-7">
          {activeTab === "consignacion" && (
            <TemplateEditor
              label="Plantilla de Consignacion"
              placeholder="Ej: Hola {name}, te envio el remito de tu consignacion..."
              value={templateConsignacion}
              onChange={updateTemplateConsignacion}
              variables={SMART_VARIABLES}
              onMagicMessage={() => generateMagicMessage("consignacion")}
            />
          )}

          {activeTab === "venta" && (
            <TemplateEditor
              label="Plantilla de Venta POS"
              placeholder="Ej: Hola {name}, gracias por tu compra..."
              value={templateVenta}
              onChange={updateTemplateVenta}
              variables={SMART_VARIABLES}
              onMagicMessage={() => generateMagicMessage("venta")}
            />
          )}

          {activeTab === "tienda" && (
            <TemplateEditor
              label="Pedido en Tienda Online"
              placeholder="Ej: Hola, vi el producto {nombre_producto}..."
              value={templateTienda}
              onChange={updateTemplateTienda}
              variables={[
                { label: "Nombre Producto", value: "{nombre_producto}" },
              ]}
              onMagicMessage={() => generateMagicMessage("tienda")}
              showWhatsappNumber
              whatsappNumber={whatsappNumber}
              onWhatsappNumberChange={updateWhatsappNumber}
            />
          )}

          {activeTab === "listaProductos" && (
            <ProductListGenerator
              value={templateListaProductos}
              onChange={setTemplateListaProductos}
            />
          )}
        </section>

        <aside className="hidden xl:flex xl:col-span-5 xl:sticky xl:top-6 justify-center">
          <WhatsAppPreview
            text={getPreviewText()}
            businessName={businessName}
          />
        </aside>
      </div>

      {portalReady &&
        previewOpen &&
        createPortal(
          <div className="fixed inset-0 z-[2147483000] bg-black/58 backdrop-blur-[2px]">
            <div className="h-full flex flex-col">
              <div className="border-b border-border/60 px-3 py-2.5 flex items-center justify-between">
                <p className="text-sm font-semibold">
                  Vista previa de WhatsApp
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setPreviewOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-zinc-100 via-zinc-50 to-zinc-100 dark:from-zinc-900 dark:via-zinc-900/70 dark:to-zinc-950">
                <WhatsAppPreview
                  text={getPreviewText()}
                  businessName={businessName}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

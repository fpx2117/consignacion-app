"use client";

import * as React from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, ShoppingCart, Sparkles, List } from "lucide-react";

import { apiService } from "@/lib/apiService";
import { useSucursalStore } from "@/store/useSucursalStore";

// Components
import { WhatsAppHeader } from "./components/WhatsAppHeader";
import { WhatsAppPreview } from "./components/WhatsAppPreview";
import { TemplateEditor } from "./components/TemplateEditor";
import { ProductListGenerator } from "./components/ProductListGenerator";

const MAGIC_TEMPLATES = {
    consignacion: [
        "*AllData POS - Notificación de Consignación*\n\nHola {name}, te enviamos el detalle de tu consignación.\n📄 *Ver Remito:* {url}\n\nGracias por confiar en nosotros! 🚀",
        "Estimado/a {name}, aquí tienes el link de tu consignación realizada hoy {date}.\n\n🔗 *Link:* {url}\n📦 *Items:* {items}\n\n_Tu negocio, siempre al día._",
        "Hola {name}! 👋 Te compartimos el remito digital de tu nueva consignación.\n\n💰 *Total Estimado:* {total}\n📄 *Documento:* {url}\n\nCualquier duda, estamos a disposición.",
    ],
    venta: [
        "*¡Gracias por tu compra, {name}!* 🎉\n\nTu ticket digital ya está disponible.\n💳 *Total:* {total}\n📄 *Ver Ticket:* {url}\n\nEsperamos verte pronto por aquí! ✨",
        "Hola {name}! Aquí tienes el comprobante de tu compra de hoy {date}.\n\n🛒 *Productos:* {items}\n💰 *Monto:* {total}\n🔗 {url}\n\n_AllData POS - Simplicidad en tu gestión._",
        "Ticket Digital - *AllData POS*\n\nHola {name}, adjuntamos tu ticket por la compra de *{items} items*.\n💵 *Total Final:* {total}\n✅ {url}\n\n¡Que tengas un excelente día!",
    ],
    tienda: [
        "Hola, estoy interesado en el producto *{nombre_producto}*. ¿Podrías darme más información?",
        "Hola! 👋 Vi el producto *{nombre_producto}* en tu tienda online y me gustaría pedirlo.",
        "Hola, quisiera consultar disponibilidad de *{nombre_producto}* que vi en el catálogo.",
    ]
};

const SMART_VARIABLES = [
    { label: "Nombre Cliente", value: "{name}" },
    { label: "Link del Ticket/Remito", value: "{url}" },
    { label: "Total", value: "{total}" },
    { label: "Items", value: "{items}" },
    { label: "Fecha", value: "{date}" },
];

export default function WhatsAppSettingsPage() {
    const activeSucursalId = useSucursalStore((state) => state.activeSucursalId);

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    // Templates State
    const [templateConsignacion, setTemplateConsignacion] = React.useState("");
    const [templateVenta, setTemplateVenta] = React.useState("");
    const [templateTienda, setTemplateTienda] = React.useState("");
    const [templateListaProductos, setTemplateListaProductos] = React.useState("");
    const [whatsappNumber, setWhatsappNumber] = React.useState("");
    const [businessName, setBusinessName] = React.useState("");

    const [activeTab, setActiveTab] = React.useState("consignacion");

    // Load data based on current branch
    React.useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                // Fetch config and branding. 
                // Note: The API should handle branch-specific logic internally 
                // based on the active session or a sucursalId if required.
                const config = await apiService.getConfiguracionGeneral();
                const branding = await apiService.getBranding();

                setTemplateConsignacion(config?.mensajeWhatsappConsignacion || "");
                setTemplateVenta(config?.mensajeWhatsappVenta || "");
                setTemplateTienda(branding?.whatsappMessage || "");
                setWhatsappNumber(branding?.whatsappNumber || "");
                setBusinessName(branding?.businessName || "Tu Negocio");

            } catch (e: any) {
                toast.error("Error al cargar configuración de la sucursal");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [activeSucursalId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                apiService.actualizarConfiguracionGeneral({
                    mensajeWhatsappConsignacion: templateConsignacion,
                    mensajeWhatsappVenta: templateVenta,
                }),
                apiService.actualizarBranding({
                    whatsappMessage: templateTienda,
                    whatsappNumber: whatsappNumber,
                })
            ]);
            toast.success("Configuración de WhatsApp guardada para esta sucursal.");
        } catch (e: any) {
            toast.error(e.message || "Error al guardar cambios");
        } finally {
            setSaving(false);
        }
    };

    const generateMagicMessage = (type: "consignacion" | "venta" | "tienda") => {
        const templates = MAGIC_TEMPLATES[type];
        const randomTemplate = templates[Math.floor(Math.random() * templates.length)];

        if (type === "consignacion") setTemplateConsignacion(randomTemplate);
        else if (type === "venta") setTemplateVenta(randomTemplate);
        else setTemplateTienda(randomTemplate);

        toast.success("¡Mensaje mágico generado!", {
            icon: <Sparkles className="h-4 w-4 text-amber-500" />
        });
    };

    const getPreviewText = () => {
        let raw = "";
        switch (activeTab) {
            case "consignacion": raw = templateConsignacion || "*Remito*\n\nHola {name}.\n📄 Remito: {url}"; break;
            case "venta": raw = templateVenta || "*Ticket*\n\nHola {name}, ¡Gracias por tu compra!\n📄 Ticket: {url}"; break;
            case "tienda": raw = templateTienda || "Hola! 👋 Vi el producto *{nombre_producto}* y me gustaría pedirlo."; break;
            case "listaProductos": raw = templateListaProductos || "Genera la lista para ver la vista previa..."; break;
        }

        return raw
            .replace(/{name}/g, "Juan Pérez")
            .replace(/{url}/g, "https://alldata.pos/t/123xyz")
            .replace(/{total}/g, "$150,000")
            .replace(/{items}/g, "3")
            .replace(/{date}/g, new Date().toLocaleDateString('es-AR'))
            .replace(/{nombre_producto}/g, "Producto de Ejemplo");
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[400px]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
                <p className="mt-4 text-muted-foreground animate-pulse">Cargando configuración de sucursal...</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-10 space-y-8 animate-in fade-in duration-500">
            <WhatsAppHeader onSave={handleSave} saving={saving} />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                <div className="xl:col-span-12">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid grid-cols-4 w-full max-w-4xl h-14 bg-emerald-500/5 p-1 rounded-2xl border border-emerald-500/10 mb-6">
                            <TabsTrigger value="consignacion" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300">
                                <Package className="h-4 w-4" />
                                <span className="hidden sm:inline">Remito Consignación</span>
                                <span className="sm:hidden">Consig.</span>
                            </TabsTrigger>
                            <TabsTrigger value="venta" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300">
                                <ShoppingCart className="h-4 w-4" />
                                <span className="hidden sm:inline">Ticket Venta (POS)</span>
                                <span className="sm:hidden">Venta</span>
                            </TabsTrigger>
                            <TabsTrigger value="tienda" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300">
                                <Sparkles className="h-4 w-4" />
                                <span className="hidden sm:inline">Pedido en Tienda</span>
                                <span className="sm:hidden">Tienda</span>
                            </TabsTrigger>
                            <TabsTrigger value="listaProductos" className="rounded-xl font-bold gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all duration-300">
                                <List className="h-4 w-4" />
                                <span className="hidden sm:inline">Lista de Productos</span>
                                <span className="sm:hidden">Lista</span>
                            </TabsTrigger>
                        </TabsList>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-0">
                            <div className="lg:col-span-7 space-y-6">
                                <TabsContent value="consignacion" className="mt-0 border-none p-0 outline-none">
                                    <TemplateEditor
                                        label="Plantilla de Consignación"
                                        placeholder="Ej: Hola {name}, te envío el remito..."
                                        value={templateConsignacion}
                                        onChange={setTemplateConsignacion}
                                        variables={SMART_VARIABLES}
                                        onMagicMessage={() => generateMagicMessage("consignacion")}
                                    />
                                </TabsContent>

                                <TabsContent value="venta" className="mt-0 border-none p-0 outline-none">
                                    <TemplateEditor
                                        label="Plantilla de Venta POS"
                                        placeholder="Ej: ¡Hola {name}! Gracias por tu compra..."
                                        value={templateVenta}
                                        onChange={setTemplateVenta}
                                        variables={SMART_VARIABLES}
                                        onMagicMessage={() => generateMagicMessage("venta")}
                                    />
                                </TabsContent>

                                <TabsContent value="tienda" className="mt-0 border-none p-0 outline-none">
                                    <TemplateEditor
                                        label="Plantilla de Pedido en Tienda"
                                        placeholder="Ej: Hola! 👋 Vi el producto *{nombre_producto}*..."
                                        value={templateTienda}
                                        onChange={setTemplateTienda}
                                        variables={[{ label: "Nombre Producto", value: "{nombre_producto}" }]}
                                        onMagicMessage={() => generateMagicMessage("tienda")}
                                        showWhatsappNumber
                                        whatsappNumber={whatsappNumber}
                                        onWhatsappNumberChange={setWhatsappNumber}
                                    />
                                </TabsContent>

                                <TabsContent value="listaProductos" className="mt-0 border-none p-0 outline-none">
                                    <ProductListGenerator
                                        value={templateListaProductos}
                                        onChange={setTemplateListaProductos}
                                    />
                                </TabsContent>
                            </div>

                            <div className="lg:col-span-5 flex flex-col items-center justify-center lg:sticky lg:top-8">
                                <WhatsAppPreview text={getPreviewText()} businessName={businessName} />
                            </div>
                        </div>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

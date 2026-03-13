/* eslint-disable */
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerCatalogVisit } from "@/lib/analytics/catalog-visit";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const sucursalIdParam = searchParams.get("sucursalId");
    const sucursalId = sucursalIdParam ? Number(sucursalIdParam) : null;

    try {
        // Encontrar la configuración de la sucursal solicitada o la principal
        const config = await prisma.configuracion.findUnique({
            where: { sucursalId: sucursalId || 1 },
            include: {
                sucursal: {
                    include: {
                        branding: {
                            include: {
                                banners: {
                                    orderBy: { orden: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        }) as any;

        if (!config || !config.mostrarListaPrecios) {
            return NextResponse.json({ error: "La lista de precios no está habilitada" }, { status: 403 });
        }

        try {
            await registerCatalogVisit({
                sucursalId: config.sucursalId,
                headers: req.headers,
            });
        } catch (visitError) {
            console.warn("Catalog visit tracking failed:", visitError);
        }

        const where: any = { activo: true };

        // Si el usuario marcó "separarListaPorSucursal", filtramos por la sucursal de la config
        if (config.separarListaPorSucursal) {
            where.sucursalId = config.sucursalId;
        }

        const [productos, categorias] = await Promise.all([
            prisma.producto.findMany({
                where,
                include: {
                    categoria: true,
                    subcategoria: true
                },
                orderBy: { nombre: "asc" }
            }),
            prisma.categoria.findMany({
                include: {
                    subcategorias: {
                        orderBy: { nombre: "asc" }
                    }
                },
                orderBy: { nombre: "asc" }
            })
        ]);

        return NextResponse.json({
            data: {
                productos,
                categorias,
                config: {
                    businessName: config.sucursal.branding?.businessName || config.sucursal.nombre,
                    primaryColor: config.sucursal.branding?.primaryColor || "#111827",
                    secondaryColor: config.sucursal.branding?.secondaryColor || "#3b82f6",
                    logoMime: config.sucursal.branding?.logoMime,
                    logoData: config.sucursal.branding?.logoData ? Buffer.from(config.sucursal.branding.logoData).toString('base64') : null,
                    bannerMime: config.sucursal.branding?.bannerMime,
                    bannerData: config.sucursal.branding?.bannerData ? Buffer.from(config.sucursal.branding.bannerData).toString('base64') : null,
                    isBannerSlider: config.sucursal.branding?.isBannerSlider || false,
                    banners: config.sucursal.branding?.banners ? config.sucursal.branding.banners.map((b: any) => ({
                        id: b.id,
                        bannerData: Buffer.from(b.bannerData).toString('base64'),
                        bannerMime: b.bannerMime,
                        orden: b.orden
                    })) : [],
                    instagramUrl: config.sucursal.branding?.instagramUrl,
                    tiktokUrl: config.sucursal.branding?.tiktokUrl,
                    facebookUrl: config.sucursal.branding?.facebookUrl,
                    youtubeUrl: config.sucursal.branding?.youtubeUrl,
                    whatsappNumber: config.sucursal.branding?.whatsappNumber,
                    whatsappMessage: config.sucursal.branding?.whatsappMessage,
                    phone: config.sucursal.branding?.phone,
                    address: config.sucursal.branding?.address,
                    googleMapsUrl: config.sucursal.branding?.googleMapsUrl,
                    footerText: config.sucursal.branding?.footerText,
                    themeIdentifier: config.sucursal.branding?.themeIdentifier || "modern",
                    tiendaLayout: config.tiendaLayout,
                    mostrarCategoriasEnHeader: config.mostrarCategoriasEnHeader,
                    convertirTienda: config.convertirTienda,
                    mostrarPreciosConsignacion: config.mostrarPreciosConsignacion,
                    porcentajeAumentoConsignacion: config.porcentajeAumentoConsignacion,
                    porcentajeInteresTarjeta: config.porcentajeInteresTarjeta,
                    mpPublicKeyTienda: config.mpPublicKeyTienda
                }
            }
        });
    } catch (error: any) {
        console.error("Error public lista-precios:", error);
        return NextResponse.json({ error: "Error al obtener los productos" }, { status: 500 });
    }
}

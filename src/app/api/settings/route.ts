import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth/require-auth";
import { storeThemeConfigSchema, onlineStoreSettingsSchema } from "@/lib/validators/settings";

export async function GET(req: Request) {
  try {
    // Intentar obtener sucursalId del querystring, sino por defecto 1
    const { searchParams } = new URL(req.url);
    const sucursalIdParam = searchParams.get("sucursalId");
    let sucursalId = 1;

    if (sucursalIdParam) {
      sucursalId = Number(sucursalIdParam);
    } else {
      // Intentar leer de auth si existe, para compatibilidad con el panel admin
      const auth = await requireAuth().catch(() => ({ ok: false, activeSucursalId: 1 }));
      if (auth && auth.ok && auth.activeSucursalId) {
        sucursalId = auth.activeSucursalId;
      }
    }

    const settings = await prisma.storeSettings.findUnique({
      where: { sucursalId },
    });

    if (!settings) {
      // Devuelve la configuración por defecto si no existe
      return NextResponse.json({
        data: {
          id: null,
          themeConfig: storeThemeConfigSchema.parse({}),
          onlineStoreConfig: onlineStoreSettingsSchema.parse({}),
        },
      });
    }

    return NextResponse.json({
      data: {
        id: settings.id,
        themeConfig: settings.themeConfig,
        onlineStoreConfig: settings.onlineStoreConfig ?? onlineStoreSettingsSchema.parse({}),
      },
    });
  } catch (error) {
    console.error("Error al obtener settings:", error);
    return NextResponse.json(
      { error: "Error al obtener la configuración" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { themeConfig, onlineStoreConfig } = body;

    if (!themeConfig && !onlineStoreConfig) {
      return NextResponse.json(
        { error: "Faltan datos de configuración" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (themeConfig) {
      updateData.themeConfig = storeThemeConfigSchema.parse(themeConfig);
    }

    if (onlineStoreConfig) {
      updateData.onlineStoreConfig = onlineStoreSettingsSchema.parse(onlineStoreConfig);
    }

    const updatedSettings = await prisma.storeSettings.upsert({
      where: { sucursalId: auth.activeSucursalId },
      update: updateData,
      create: {
        sucursalId: auth.activeSucursalId,
        themeConfig: storeThemeConfigSchema.parse(themeConfig || {}),
        onlineStoreConfig: onlineStoreConfig ? onlineStoreSettingsSchema.parse(onlineStoreConfig) : undefined,
      },
    });

    return NextResponse.json({
      message: "Configuración actualizada correctamente",
      data: updatedSettings,
    });
  } catch (error) {
    console.error("Error actualizando settings:", error);
    return NextResponse.json(
      { error: "Error al actualizar la configuración" },
      { status: 500 }
    );
  }
}

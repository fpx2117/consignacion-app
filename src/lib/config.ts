import { prisma } from "@/lib/prisma";

/**
 * Obtiene la configuración de una sucursal específica.
 * Si no existe, la crea con valores por defecto.
 */
export async function obtenerConfiguracionGlobal(sucursalId: number = 1) {
  try {
    // Intentamos buscar la configuración por sucursal
    const config = await prisma.configuracion.findUnique({
      where: { sucursalId },
    });

    // Si ya existe, la devolvemos
    if (config) {
      return config;
    }

    // Si no existe, creamos la default para esa sucursal
    const nuevaConfig = await prisma.configuracion.create({
      data: {
        sucursalId,
      },
    });

    return nuevaConfig;
  } catch (error) {
    console.error(
      `⚠️ Error obteniendo configuración para sucursal ${sucursalId}:`,
      error,
    );

    // Fallback compatible con el modelo
    return {
      id: 0,
      sucursalId,
      minStockGlobal: 5,
      diasAnticipacionVencimiento: 7,
      notificarVencimientos: true,
      notificarStockBajo: true,
      notificarVentas: true,
      notificarLiquidaciones: true,
      notificarConsignacionesActivas: true,
      diasAvisoConsignacion: 15,
      usarControlDeCaja: true,
      mensajeWhatsappConsignacion: null,
      mensajeWhatsappVenta: null,
      porcentajeAumentoConsignacion: 0,
      mostrarPreciosConsignacion: false,
      porcentajeInteresTarjeta: 0,
      convertirTienda: false,
      mostrarListaPrecios: false,
      mpAccessTokenTienda: null,
      mpPublicKeyTienda: null,
      separarListaPorSucursal: true,
      mostrarCategoriasEnHeader: true,
      tiendaLayout: "grid",
      andreaniContratoDomicilio: null,
      andreaniContratoSucursal: null,
      andreaniCliente: null,
      andreaniUsuario: null,
      andreaniPassword: null,
    };
  }
}

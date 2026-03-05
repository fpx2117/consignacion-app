import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { andreaniService } from "@/lib/andreaniService";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sucursalId, codigoPostal, subtotal, pesoKg = 1 } = body;

        if (!codigoPostal) {
            return NextResponse.json({ error: "El código postal es requerido" }, { status: 400 });
        }

        const sucursalIdNum = sucursalId ? Number(sucursalId) : 1;

        // Obtener configuración
        const config = await prisma.configuracion.findUnique({
            where: { sucursalId: sucursalIdNum }
        });

        if (!config || !config.convertirTienda) {
            return NextResponse.json({ error: "La tienda no acepta envíos" }, { status: 403 });
        }

        // Inicializar servicio
        andreaniService.init({
            andreaniContratoDomicilio: config.andreaniContratoDomicilio,
            andreaniContratoSucursal: config.andreaniContratoSucursal,
            andreaniCliente: config.andreaniCliente,
            andreaniUsuario: config.andreaniUsuario,
            andreaniPassword: config.andreaniPassword,
        });

        if (!andreaniService.isReady()) {
            return NextResponse.json({ error: "El servicio de envíos no está configurado en esta sucursal" }, { status: 400 });
        }

        // Cotizar
        const tarifas = await andreaniService.cotizarEnvio(codigoPostal, subtotal, pesoKg);

        return NextResponse.json({ data: tarifas });
    } catch (error: any) {
        console.error("Error al cotizar envío:", error);
        return NextResponse.json({ error: error.message || "Error al cotizar envío" }, { status: 500 });
    }
}

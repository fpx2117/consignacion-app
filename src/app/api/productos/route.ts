import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { createProductoSchema } from "@/lib/validators/producto";

// ✅ 1. Importamos sistema de notificaciones
import { sendNotification } from "@/lib/socket-trigger";
// Asegúrate de que esta ruta sea la correcta (vi que la cambiaste a esta carpeta):
import { NOTIFICATION_TYPE } from "@/lib/notificationes/notificaciones-types"; 

// ✅ 2. Importamos el Helper de Configuración (Vital para no hardcodear el 5)
import { obtenerConfiguracionGlobal } from "@/lib/config";

// --- GET: OBTENER PRODUCTOS ---
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const productos = await prisma.producto.findMany({
      orderBy: { id: "desc" },
    });

    return NextResponse.json({ data: productos });
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    return NextResponse.json(
      { error: "Error interno al obtener productos" },
      { status: 500 }
    );
  }
}

// --- POST: CREAR PRODUCTO ---
export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    
    // Asegúrate de que tu Zod Schema (createProductoSchema) acepte 
    // 'stockMinUnits' y 'fechaVencimiento' como opcionales.
    const parsed = createProductoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: "Validación fallida", 
          details: parsed.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const stockInicial = parsed.data.stockDisponibleUnits ?? 0;

    // ✅ 3. OBTENER CONFIGURACIÓN DINÁMICA
    const configGlobal = await obtenerConfiguracionGlobal();

    // Calculamos el umbral real:
    // Si el usuario mandó un mínimo específico (ej: 20), usamos ese.
    // Si no, usamos el global de la DB (ej: 5).
    // Nota: Asumo que en Zod agregaste stockMinUnits. Si no, usa configGlobal.minStockGlobal directo.
    const umbralAlerta = (parsed.data as any).stockMinUnits ?? configGlobal.minStockGlobal;

    // ✅ 4. CREAR EN BASE DE DATOS (Incluyendo campos nuevos)
    const created = await prisma.producto.create({
      data: {
        nombre: parsed.data.nombre,
        precioVenta: parsed.data.precioVenta,
        precioCosto: parsed.data.precioCosto,
        stockDisponibleUnits: stockInicial,
        stockConsignadoUnits: 0,
        packSizeUnits: parsed.data.packSizeUnits ?? null,
        
        // Guardamos el mínimo específico si vino (0 = usa global)
        stockMinUnits: (parsed.data as any).stockMinUnits ?? 0,
        
        // Guardamos fecha de vencimiento si vino
        fechaVencimiento: (parsed.data as any).fechaVencimiento 
          ? new Date((parsed.data as any).fechaVencimiento) 
          : null,
      },
    });

    // --- ✅ LÓGICA DE NOTIFICACIÓN ---
    
    // CASO 1: Agotado (Stock 0)
    if (stockInicial === 0) {
      await sendNotification({
        type: NOTIFICATION_TYPE.OUT_OF_STOCK,
        title: "Nuevo Producto Sin Stock",
        message: `Se ha creado "${created.nombre}" sin inventario inicial.`,
        data: { productId: created.id }
      });
    } 
    // CASO 2: Stock Bajo (Usando la variable dinámica 'umbralAlerta')
    else if (stockInicial <= umbralAlerta) {
      await sendNotification({
        type: NOTIFICATION_TYPE.LOW_STOCK,
        title: "Nuevo Producto con Stock Bajo",
        message: `"${created.nombre}" inicia con ${stockInicial} u. (El mínimo es ${umbralAlerta}).`,
        data: { productId: created.id }
      });
    }

    return NextResponse.json({ data: created }, { status: 201 });

  } catch (error) {
    console.error("Error creando producto:", error);
    return NextResponse.json(
      { error: "Error interno al crear el producto" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { createProductoSchema } from "@/lib/validators/producto";

// --- FUNCIÓN AUXILIAR (Actualizada para Custom Server) ---
// Al usar Custom Server, siempre notificamos a localhost:3000 internamente.
async function notificarSocket(payload: any) {
  // Hardcodeamos localhost:3000 porque server.ts siempre escucha ahí.
  const url = "http://localhost:3000/api/socket/dispatch";
  
  try {
    console.log("🔔 (Backend Create) Intentando notificar socket:", payload.title);
    
    // Fire-and-forget: Fetch sin await bloqueante
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification: payload }),
    }).catch((err) => console.error("⚠️ Error en dispatch socket (fetch):", err));
    
  } catch (error) {
    console.error("❌ Error general intentando notificar:", error);
  }
}

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

    // Solo administradores pueden crear productos
    if (!requireRole(auth.user, ["ADMIN"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    
    // Validación con Zod
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

    // Definir stock inicial (si es nulo o undefined, es 0)
    const stockInicial = parsed.data.stockDisponibleUnits ?? 0;

    // Crear en Base de Datos
    const created = await prisma.producto.create({
      data: {
        nombre: parsed.data.nombre,
        precioVenta: parsed.data.precioVenta,
        precioCosto: parsed.data.precioCosto,
        stockDisponibleUnits: stockInicial,
        stockConsignadoUnits: 0,
        packSizeUnits: parsed.data.packSizeUnits ?? null,
      },
    });

    // --- LÓGICA DE NOTIFICACIÓN SOCKET ---
    // Si se crea un producto con 0 stock, enviamos la alerta en tiempo real
    if (stockInicial === 0) {
      const notificationData = {
        id: Date.now().toString(),
        title: "Nuevo Producto Sin Stock",
        description: `Se ha creado "${created.nombre}" pero no tiene inventario inicial.`,
        type: "out_of_stock", 
        time: new Date().toLocaleTimeString('es-AR', { hour: "2-digit", minute: "2-digit" }),
        productoId: created.id,
      };

      // Llamada directa (ya no necesitamos pasarle el host)
      notificarSocket(notificationData);
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
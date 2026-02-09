import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/requireAuth";
import { updateProductoSchema } from "@/lib/validators/producto";

type RouteParams = { params: Promise<{ id: string }> };

// --- FUNCIÓN AUXILIAR PARA NOTIFICAR ---
// Al usar Custom Server, siempre notificamos a localhost:3000 internamente.
async function notificarSocket(payload: any) {
  // Hardcodeamos localhost:3000 porque server.ts siempre escucha ahí.
  // Esto es más rápido y evita errores de SSL en comunicación interna.
  const url = "http://localhost:3000/api/socket/dispatch";
  
  try {
    console.log("🔔 (Backend) Intentando notificar socket:", payload.title);
    
    // No usamos 'await' para no retrasar la respuesta al usuario (Fire-and-forget)
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification: payload }),
    }).catch((err) => console.error("⚠️ Error en dispatch socket (fetch):", err));
    
  } catch (error) {
    console.error("❌ Error general intentando notificar:", error);
  }
}

// --- GET: OBTENER UN PRODUCTO ---
export async function GET(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const producto = await prisma.producto.findUnique({ where: { id } });
  if (!producto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ data: producto });
}

// --- PUT: ACTUALIZAR PRODUCTO ---
export async function PUT(req: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  // Protección contra body vacío o mal formado
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body inválido o vacío" }, { status: 400 });
  }

  // LIMPIEZA: Eliminamos campos que no se deben tocar manualmente
  const { 
    id: _id, 
    createdAt: _c, 
    updatedAt: _u, 
    stockConsignadoUnits: _s, 
    ...dataToValidate 
  } = body;

  const parsed = updateProductoSchema.safeParse(dataToValidate);

  if (!parsed.success) {
    return NextResponse.json(
      { 
        error: "Validación fallida", 
        details: parsed.error.flatten().fieldErrors 
      },
      { status: 400 }
    );
  }

  // 1. OBTENEMOS EL ESTADO ANTERIOR (Vital para comparar stock)
  const exists = await prisma.producto.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    // 2. ACTUALIZAMOS EN BASE DE DATOS
    const updated = await prisma.producto.update({
      where: { id },
      data: parsed.data, 
    });

    // 3. LÓGICA DE NOTIFICACIÓN SOCKET
    // Condición: Stock baja a 0 Y antes era mayor a 0
    if (updated.stockDisponibleUnits === 0 && exists.stockDisponibleUnits > 0) {
      
      const notificationData = {
        id: Date.now().toString(),
        title: "¡Stock Agotado!",
        description: `El producto "${updated.nombre}" se quedó sin stock.`,
        type: "out_of_stock",
        time: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        productoId: updated.id
      };

      // Llamamos a la función auxiliar
      notificarSocket(notificationData);
    }

    return NextResponse.json({ data: updated });

  } catch (error) {
    console.error("Error en Prisma UPDATE:", error);
    return NextResponse.json(
      { error: "Error interno al actualizar el producto" }, 
      { status: 500 }
    );
  }
}

// --- DELETE: ELIMINAR PRODUCTO ---
export async function DELETE(_: Request, { params }: RouteParams) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;

  if (!requireRole(auth.user, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);

  if (!Number.isFinite(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const exists = await prisma.producto.findUnique({ where: { id } });
  if (!exists) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    await prisma.producto.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return NextResponse.json(
      { error: "Conflicto: El producto tiene registros asociados y no puede eliminarse." }, 
      { status: 409 }
    );
  }
}
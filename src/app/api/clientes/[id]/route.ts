import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/require-auth";
import { canAccessSucursalResource, isGlobalSucursalView } from "@/lib/sucursalScope";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// ----------------------------------------------------------------------
// GET: Obtener cliente (Corrección: Devuelve { data: cliente })
// ----------------------------------------------------------------------
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { id: idString } = await params;
    const id = Number(idString);

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!cliente || !canAccessSucursalResource(auth, cliente.sucursalId)) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // ✅ IMPORTANTE: Envolvemos en 'data' para que apiService lo lea bien
    return NextResponse.json({ data: cliente });

  } catch (error) {
    console.error("Error GET cliente:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// PUT: Actualizar cliente
// ----------------------------------------------------------------------
export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
      return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para editar clientes." }, { status: 409 });
    }

    const { id: idString } = await params;
    const id = Number(idString);

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.cliente.findUnique({ where: { id } });
    if (!existing || existing.sucursalId !== auth.activeSucursalId) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const body = await request.json();
    const { nombre, telefono, direccion, activo } = body;

    const clienteActualizado = await prisma.cliente.update({
      where: { id },
      data: {
        nombre: nombre?.trim(),
        telefono: telefono ? String(telefono).trim() : null,
        direccion: direccion ? String(direccion).trim() : null,
        // Si activo viene en el body lo usamos, sino se ignora (undefined no actualiza)
        ...(activo !== undefined && { activo: Boolean(activo) }),
      },
    });

    // ✅ Envolvemos en 'data'
    return NextResponse.json({ data: clienteActualizado });

  } catch (error) {
    console.error("Error PUT cliente:", error);
    return NextResponse.json({ error: "Error al actualizar" }, { status: 500 });
  }
}

// ----------------------------------------------------------------------
// DELETE: Eliminar/Desactivar cliente
// ----------------------------------------------------------------------
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (isGlobalSucursalView(auth)) {
      return NextResponse.json({ error: "Vista global en modo solo lectura. Selecciona una sucursal para eliminar clientes." }, { status: 409 });
    }

    const { id: idString } = await params;
    const id = Number(idString);

    if (isNaN(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const existing = await prisma.cliente.findUnique({ where: { id } });
    if (!existing || existing.sucursalId !== auth.activeSucursalId) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // Eliminación lógica (recomendada)
    const clienteDesactivado = await prisma.cliente.update({
      where: { id },
      data: { activo: false },
    });

    // ✅ Envolvemos en 'data'
    return NextResponse.json({
      data: clienteDesactivado,
      message: "Cliente desactivado correctamente"
    });

  } catch (error) {
    console.error("Error DELETE cliente:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

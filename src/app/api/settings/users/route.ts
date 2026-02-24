import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkUserLimit } from "@/lib/requireSubscription";

// --- GET: Listar usuarios ---
export async function GET() {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nombre: true,
        email: true,
        rol: true,
        activo: true,
        sucursalId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, data: usuarios });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// --- POST: Crear usuario ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nombre, email, password, rol, sucursalId } = body;

    if (!nombre || !email || !password || !rol) {
      return NextResponse.json({ ok: false, error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Guard: Verificar límite de usuarios del plan
    const userCheck = await checkUserLimit();
    if (!userCheck.allowed) {
      return NextResponse.json({ ok: false, error: userCheck.message, limitReached: true }, { status: 403 });
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) {
      return NextResponse.json({ ok: false, error: "Ya existe un usuario con este correo" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const nuevoUsuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        hash,
        rol,
        sucursalId: sucursalId ? Number(sucursalId) : 1,
        activo: true
      },
      select: { id: true, nombre: true, email: true, rol: true, sucursalId: true, activo: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, data: nuevoUsuario });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// --- PUT: Editar usuario ---
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    // Agregamos "rol" a la desestructuración
    const { id, nombre, email, password, rol, sucursalId } = body;

    if (!id || !nombre || !email || !rol) {
      return NextResponse.json({ ok: false, error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe && existe.id !== id) {
      return NextResponse.json({ ok: false, error: "El correo ya está en uso por otro usuario" }, { status: 400 });
    }

    // Incluimos el rol en la data a actualizar
    const dataToUpdate: any = {
      nombre,
      email,
      rol,
      sucursalId: sucursalId ? Number(sucursalId) : null
    };

    if (password && password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      dataToUpdate.hash = await bcrypt.hash(password, salt);
    }

    const usuarioActualizado = await prisma.usuario.update({
      where: { id },
      data: dataToUpdate,
      select: { id: true, nombre: true, email: true, rol: true, sucursalId: true, activo: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, data: usuarioActualizado });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// --- DELETE: Eliminar usuario ---
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, error: "Falta el ID del usuario" }, { status: 400 });
    }

    await prisma.usuario.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ ok: true, message: "Usuario eliminado" });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { validatePasswordStrength } from "@/lib/validators/password";

export async function POST(req: Request) {
    try {
        const { token, password } = await req.json();

        if (!token || !password) {
            return NextResponse.json(
                { message: "Token o nueva contraseña faltante" },
                { status: 400 }
            );
        }

        // Validate password strength server-side
        const passwordCheck = validatePasswordStrength(password);
        if (!passwordCheck.valid) {
            return NextResponse.json(
                { message: passwordCheck.errors.join(". ") },
                { status: 400 }
            );
        }

        // Buscar token
        const tokenRecord = await prisma.resetPasswordToken.findUnique({
            where: { token },
        });

        if (!tokenRecord) {
            return NextResponse.json(
                { message: "Enlace inválido o expirado" },
                { status: 400 }
            );
        }

        if (tokenRecord.expiresAt < new Date()) {
            return NextResponse.json(
                { message: "El enlace de recuperación ha expirado" },
                { status: 400 }
            );
        }

        // Encontrar usuario
        const user = await prisma.usuario.findUnique({
            where: { email: tokenRecord.email },
        });

        if (!user) {
            return NextResponse.json(
                { message: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        // Hashear nueva contraseña
        const hash = await bcrypt.hash(password, 10);

        // Actualizar usuario y eliminar token
        await prisma.$transaction([
            prisma.usuario.update({
                where: { id: user.id },
                data: { hash },
            }),
            prisma.resetPasswordToken.delete({
                where: { token },
            }),
        ]);

        return NextResponse.json(
            { message: "Contraseña actualizada con éxito" },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error en reset-password:", error);
        return NextResponse.json(
            { message: "Ocurrió un error al procesar la solicitud" },
            { status: 500 }
        );
    }
}

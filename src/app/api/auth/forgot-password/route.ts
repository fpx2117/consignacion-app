import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { email } = await req.json();

        if (!email) {
            return NextResponse.json(
                { message: "El email es requerido" },
                { status: 400 }
            );
        }

        const cleanEmail = email.trim().toLowerCase();

        // Buscar si el usuario existe
        const user = await prisma.usuario.findUnique({
            where: { email: cleanEmail },
        });

        if (!user) {
            // Para evitar email enumeration attacks, siempre respondemos que si existe pusimos éxito
            return NextResponse.json(
                { message: "Si existe una cuenta con ese correo, recibirás un enlace de recuperación." },
                { status: 200 }
            );
        }

        // Generar token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hora de expiración

        // Guardar token y eliminar anteriores para ese email
        await prisma.$transaction([
            prisma.resetPasswordToken.deleteMany({
                where: { email: cleanEmail },
            }),
            prisma.resetPasswordToken.create({
                data: {
                    email: cleanEmail,
                    token,
                    expiresAt,
                },
            }),
        ]);

        // url base
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const resetLink = `${baseUrl}/reset-password?token=${token}`;

        if (process.env.RESEND_API_KEY) {
            // Enviar correo electrónico
            await resend.emails.send({
                from: "Sistema <onboarding@resend.dev>", // Cambia esto por tu dominio verificado si tenés
                to: cleanEmail,
                subject: "Recuperación de contraseña",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #f1f5f9; padding: 20px; text-align: center;">
              <h1 style="color: #0f172a; margin: 0; font-size: 24px;">Recuperación de contraseña</h1>
            </div>
            <div style="padding: 20px;">
              <p style="color: #334155; font-size: 16px;">Hola ${user.nombre},</p>
              <p style="color: #334155; font-size: 16px;">Recibimos una solicitud para reestablecer tu contraseña. Haz clic en el siguiente botón para crear una nueva:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reestablecer contraseña</a>
              </div>
              <p style="color: #64748b; font-size: 14px;">Si no solicitaste este cambio, puedes ignorar este correo sin problemas. El enlace expirará en 1 hora.</p>
            </div>
          </div>
        `,
            });
        } else {
            console.warn("No RESEND_API_KEY found. Password reset email could not be sent for:", cleanEmail);
        }

        return NextResponse.json(
            { message: "Si existe una cuenta con ese correo, recibirás un enlace de recuperación." },
            { status: 200 }
        );
    } catch (error) {
        console.error("Error en forgot-password:", error);
        return NextResponse.json(
            { message: "Ocurrió un error al procesar la solicitud" },
            { status: 500 }
        );
    }
}

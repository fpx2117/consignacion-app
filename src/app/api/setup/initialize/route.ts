import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { validateSetupSecurity } from "./setup-security";
import {
  isVerifiedMercadoPagoActivation,
  isPayPalSubscriptionId,
  isVerifiedPayPalSubscription,
} from "../setup-payment-reference";
import {
  SUBSCRIPTION_PLANS,
  PLAN_LIMITS_DEFAULTS,
} from "@/constants/subscriptions";
import {
  EstadoSuscripcion,
  ProveedorSuscripcion,
  RolUsuario,
} from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InitializeBody = {
  admin: { nombre: string; email: string; password: string };
  planId?: number;
  staff?: Array<{ nombre: string; email: string; password?: string }>;
  businessName?: string;
  rubroNegocio?: string | null;
  promoCode?: string;
  paymentId?: string;
  // Nuevos campos del Setup Enhanced
  branding?: {
    phone?: string;
    address?: string;
    primaryColor?: string;
    logoData?: string;
    logoMime?: string;
  };
  branch?: {
    nombre: string;
    terminalNombre: string;
  };
  posConfig?: {
    usarControlDeCaja?: boolean;
    porcentajeAumentoConsignacion?: number;
    porcentajeInteresTarjeta?: number;
  };
  catalog?: {
    mostrarListaPrecios?: boolean;
    whatsappNumber?: string;
  };
  notifications?: {
    minStockGlobal?: number;
    diasAnticipacionVencimiento?: number;
    notificarStockBajo?: boolean;
    notificarVencimientos?: boolean;
    notificarVentas?: boolean;
    notificarLiquidaciones?: boolean;
    notificarConsignacionesActivas?: boolean;
    diasAvisoConsignacion?: number;
  };
};

type JsonErrorPayload = {
  message?: string;
  [key: string]: unknown;
};

type PayPalSubscriptionStatusResponse = {
  status?: string;
};

type MercadoPagoPaymentStatusResponse = {
  status?: string;
};

type MercadoPagoPreapprovalStatusResponse = {
  status?: string | null;
};

function jsonError(status: number, payload: JsonErrorPayload) {
  return NextResponse.json(payload, { status });
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v || String(v).trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function normalizeEmail(email: string) {
  return String(email).trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    requireEnv("DATABASE_URL");
    if ((await prisma.usuario.count()) > 0)
      return jsonError(403, { message: "El sistema ya ha sido inicializado" });
    let body: InitializeBody;
    try {
      body = (await req.json()) as InitializeBody;
    } catch {
      return jsonError(400, { message: "Body inválido (JSON requerido)" });
    }

    const securityError = validateSetupSecurity(body);
    if (securityError) return jsonError(400, { message: securityError });

    const {
      admin,
      planId,
      staff,
      businessName,
      rubroNegocio,
      promoCode,
      paymentId,
      branding,
      branch,
      posConfig,
      catalog,
      notifications,
    } = body;

    const adminEmail = normalizeEmail(admin.email);

    let verificationProvider: ProveedorSuscripcion | null = null;
    let verificationExternalId: string | null = null;
    const verificationStatus: EstadoSuscripcion = EstadoSuscripcion.ACTIVO;
    let trialDays = 30;
    let finalPlanId: number | null = typeof planId === "number" ? planId : null;

    if (finalPlanId !== null && finalPlanId <= 0) {
      return jsonError(400, { message: "planId inválido" });
    }
    const requestedPlan = finalPlanId
      ? SUBSCRIPTION_PLANS.find((plan) => plan.id === finalPlanId)
      : null;
    if (finalPlanId !== null && !requestedPlan)
      return jsonError(400, { message: "planId inválido" });

    if (promoCode && String(promoCode).trim() !== "") {
      const promo = await prisma.promoCode.findUnique({
        where: { code: promoCode.toUpperCase() },
        include: { plan: true },
      });

      if (!promo || !promo.activo || promo.usedCount >= promo.maxUses) {
        return jsonError(400, {
          message: "La licencia es inválida o ya fue utilizada",
        });
      }

      if (promo.expiresAt && new Date() > promo.expiresAt) {
        return jsonError(400, { message: "La licencia expiró" });
      }

      verificationProvider = ProveedorSuscripcion.PROMO;
      verificationExternalId = `PROMO-${promo.code}-${Date.now()}`;
      trialDays = promo.durationDays || 30;
      finalPlanId = promo.planId;
    } else if (paymentId && String(paymentId).trim() !== "") {
      if (!requestedPlan)
        return jsonError(400, { message: "planId requerido para el pago" });
      const pid = String(paymentId).trim();
      const isPayPal = isPayPalSubscriptionId(pid);

      if (isPayPal) {
          try {
          const { paymentConfig } = await import("@/lib/payments/config");
          const { getPayPalAccessToken } =
            await import("@/lib/payments/paypal");

          const accessToken = await getPayPalAccessToken();
          const base = paymentConfig?.paypal?.apiUrl;

          if (!base)
            return jsonError(500, { message: "PayPal apiUrl no configurado" });

          const response = await fetch(
            `${base}/v1/billing/subscriptions/${pid}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (!response.ok) {
            return jsonError(400, {
              message: "No se pudo verificar la suscripción de PayPal",
            });
          }

          const subData =
            (await response.json()) as PayPalSubscriptionStatusResponse;
          if (!isVerifiedPayPalSubscription(subData, requestedPlan, admin.email)) {
            return jsonError(400, {
              message: "La suscripción de PayPal no coincide con la activación",
            });
          }

          verificationProvider = ProveedorSuscripcion.PAYPAL;
          verificationExternalId = pid;
          trialDays = 30;
        } catch (error) {
          console.error("PayPal verification error:", error);
          return jsonError(400, { message: "Error verificando con PayPal" });
        }
      } else {
        try {
          const { paymentConfig } = await import("@/lib/payments/config");
          const mpAccessToken = paymentConfig?.mp?.accessToken;

          if (!mpAccessToken) {
            return jsonError(500, {
              message: "MercadoPago accessToken no configurado",
            });
          }

          const { MercadoPagoConfig, Payment } = await import("mercadopago");
          const mpClient = new MercadoPagoConfig({
            accessToken: mpAccessToken,
          });

          let verified = false;

          try {
            const payment = new Payment(mpClient);
            const paymentData = (await payment.get({
              id: pid,
            })) as MercadoPagoPaymentStatusResponse;

            if (isVerifiedMercadoPagoActivation(paymentData, "approved", requestedPlan.id, admin.email)) {
              verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
              verificationExternalId = pid;
              trialDays = 30;
              verified = true;
            }
          } catch {
          }

          if (!verified) {
            const { PreApproval } = await import("mercadopago");
            const preApproval = new PreApproval(mpClient);
            const subData = (await preApproval.get({
              id: pid,
            })) as MercadoPagoPreapprovalStatusResponse;

            if (!isVerifiedMercadoPagoActivation(subData, "authorized", requestedPlan.id, admin.email)) {
              return jsonError(400, {
                message: "La suscripción de Mercado Pago no coincide con la activación",
              });
            }

            verificationProvider = ProveedorSuscripcion.MERCADOPAGO;
            verificationExternalId = pid;
            trialDays = 30;
            verified = true;
          }

          if (!verified) {
            return jsonError(400, {
              message: "El pago o suscripción no está aprobado",
            });
          }
        } catch (error) {
          console.error("MercadoPago verification error:", error);
          return jsonError(400, {
            message: "No se pudo verificar con Mercado Pago",
          });
        }
      }
    } else {
      return jsonError(402, {
        message:
          "Se requiere un pago o código promocional para activar el sistema",
      });
    }

    if (!verificationProvider || !verificationExternalId) {
      return jsonError(400, {
        message: "No se pudo verificar la activación del sistema",
      });
    }

    if (finalPlanId === null) {
      finalPlanId = 1;
    }

    if (!SUBSCRIPTION_PLANS.some((plan) => plan.id === finalPlanId)) {
      return jsonError(400, { message: "planId inválido" });
    }

    let exchangeRate = 1;
    try {
      const { fetchDolarBlue } = await import("@/lib/integrations/dolarBlue");
      const r = await fetchDolarBlue();
      exchangeRate = typeof r === "number" && !Number.isNaN(r) && r > 0 ? r : 1;
    } catch (e) {
      console.warn("fetchDolarBlue failed, fallback=1:", e);
      exchangeRate = 1;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(72658463821001)`;
      if ((await tx.usuario.count()) > 0) return null;
      const branchName = branch?.nombre?.trim() || "Sucursal Principal";
      const sucursalResult = await tx.sucursal.upsert({
        where: { id: 1 },
        update: { nombre: branchName, activa: true },
        create: {
          id: 1,
          nombre: branchName,
          esPrincipal: true,
          activa: true,
        },
        select: { id: true }, // Obtener ID dinámicamente
      });
      const sucursalId = sucursalResult.id;

      for (const p of SUBSCRIPTION_PLANS) {
        const calculatedPrecioARS = p.precioUSD * exchangeRate;

        await tx.plan.upsert({
          where: { id: p.id },
          update: {
            nombre: p.nombre,
            descripcion: p.descripcion,
            precioARS: calculatedPrecioARS,
            precioUSD: p.precioUSD,
            mercadopagoId: p.mercadopagoId,
            paypalId: p.paypalId,
            activo: true,
          },
          create: {
            id: p.id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precioARS: calculatedPrecioARS,
            precioUSD: p.precioUSD,
            mercadopagoId: p.mercadopagoId,
            paypalId: p.paypalId,
            activo: true,
          },
        });

        const limits = PLAN_LIMITS_DEFAULTS[p.id];
        if (limits) {
          await tx.planLimit.upsert({
            where: { planId: p.id },
            update: {
              maxProductos: limits.maxProductos,
              maxUsuarios: limits.maxUsuarios,
              allowConsignaciones: limits.allowConsignaciones,
              allowSucursales: limits.allowSucursales,
            },
            create: {
              planId: p.id,
              maxProductos: limits.maxProductos,
              maxUsuarios: limits.maxUsuarios,
              allowConsignaciones: limits.allowConsignaciones,
              allowSucursales: limits.allowSucursales,
            },
          });
        }
      }

      // 2) Branding (id=1) - incluir datos del setup
      const brandingData = branding || {};
      const logoBuffer = brandingData.logoData
        ? Buffer.from(brandingData.logoData, "base64")
        : null;

      await tx.branding.upsert({
        where: { id: 1 },
        update: {
          ...(businessName && businessName.trim() && { businessName }),
          ...(brandingData.phone && { phone: brandingData.phone }),
          ...(brandingData.address && { address: brandingData.address }),
          ...(brandingData.primaryColor && {
            primaryColor: brandingData.primaryColor,
          }),
          ...(logoBuffer && {
            logoData: logoBuffer,
            logoMime: brandingData.logoMime,
          }),
        },
        create: {
          id: 1,
          businessName:
            businessName && businessName.trim() ? businessName : "Mi Negocio",
          phone: brandingData.phone || null,
          address: brandingData.address || null,
          primaryColor:
            brandingData.primaryColor || "var(--theme-modern-primary)",
          logoData: logoBuffer,
          logoMime: brandingData.logoMime || null,
          sucursalId: sucursalId,
        },
      });

      // 3) Configuracion - sincronizar con schema de Prisma
      const posData = posConfig || {};
      const catData = catalog || {};
      const notifData = notifications || {};

      await tx.configuracion.upsert({
        where: { sucursalId: sucursalId },
        update: {
          ...(posData.usarControlDeCaja !== undefined && {
            usarControlDeCaja: posData.usarControlDeCaja,
          }),
          ...(posData.porcentajeAumentoConsignacion !== undefined && {
            porcentajeAumentoConsignacion:
              posData.porcentajeAumentoConsignacion,
          }),
          ...(posData.porcentajeInteresTarjeta !== undefined && {
            porcentajeInteresTarjeta: posData.porcentajeInteresTarjeta,
          }),
          ...(catData.mostrarListaPrecios !== undefined && {
            mostrarListaPrecios: catData.mostrarListaPrecios,
          }),
          ...(catData.whatsappNumber && {
            mensajeWhatsappConsignacion: catData.whatsappNumber,
          }),
          ...(notifData.minStockGlobal !== undefined && {
            minStockGlobal: notifData.minStockGlobal,
          }),
          ...(notifData.diasAnticipacionVencimiento !== undefined && {
            diasAnticipacionVencimiento: notifData.diasAnticipacionVencimiento,
          }),
          ...(notifData.notificarStockBajo !== undefined && {
            notificarStockBajo: notifData.notificarStockBajo,
          }),
          ...(notifData.notificarVencimientos !== undefined && {
            notificarVencimientos: notifData.notificarVencimientos,
          }),
          ...(notifData.notificarVentas !== undefined && {
            notificarVentas: notifData.notificarVentas,
          }),
          ...(notifData.notificarLiquidaciones !== undefined && {
            notificarLiquidaciones: notifData.notificarLiquidaciones,
          }),
          ...(notifData.notificarConsignacionesActivas !== undefined && {
            notificarConsignacionesActivas:
              notifData.notificarConsignacionesActivas,
          }),
          ...(notifData.diasAvisoConsignacion !== undefined && {
            diasAvisoConsignacion: notifData.diasAvisoConsignacion,
          }),
          ...(rubroNegocio !== undefined && {
            rubroNegocio: rubroNegocio || null,
          }),
        },
        create: {
          sucursal: { connect: { id: sucursalId } },
          minStockGlobal: notifData.minStockGlobal ?? 5,
          diasAnticipacionVencimiento:
            notifData.diasAnticipacionVencimiento ?? 7,
          notificarStockBajo: notifData.notificarStockBajo ?? true,
          notificarVencimientos: notifData.notificarVencimientos ?? true,
          notificarVentas: notifData.notificarVentas ?? true,
          usarControlDeCaja: posData.usarControlDeCaja ?? true,
          diasAvisoConsignacion: notifData.diasAvisoConsignacion ?? 15,
          notificarConsignacionesActivas:
            notifData.notificarConsignacionesActivas ?? true,
          notificarLiquidaciones: notifData.notificarLiquidaciones ?? true,
          porcentajeAumentoConsignacion:
            posData.porcentajeAumentoConsignacion ?? 0,
          porcentajeInteresTarjeta: posData.porcentajeInteresTarjeta ?? 0,
          mostrarListaPrecios: catData.mostrarListaPrecios ?? false,
          mensajeWhatsappConsignacion: catData.whatsappNumber || null,
          rubroNegocio: rubroNegocio || null,
        },
      });

      // 4) Caja Principal - usar nombre del branch o default
      const terminalName = branch?.terminalNombre?.trim() || "Caja Principal";
      await tx.caja.upsert({
        where: { nombre: terminalName },
        update: { activa: true, sucursalId: sucursalId },
        create: { nombre: terminalName, activa: true, sucursalId: sucursalId },
      });

      // 5) Admin user
      const adminHash = await bcrypt.hash(admin.password, 12);
      const mainAdmin = await tx.usuario.create({
        data: {
          nombre: admin.nombre,
          email: adminEmail,
          hash: adminHash,
          rol: RolUsuario.ADMIN,
          activo: true,
          sucursalId: sucursalId,
        },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          sucursalId: true,
        },
      });

      // 6) Subscription (externalId unique)
      const trialEndsAt = new Date(
        Date.now() + trialDays * 24 * 60 * 60 * 1000,
      );

      const sub = await tx.subscription.create({
        data: {
          userId: mainAdmin.id,
          planId: finalPlanId,
          provider: verificationProvider,
          externalId: verificationExternalId,
          status: verificationStatus,
          trialEndsAt,
        },
      });

      // 7) If promoCode was used -> increment within TX (atomic)
      if (promoCode && promoCode.trim()) {
        await tx.promoCode.update({
          where: { code: promoCode.toUpperCase() },
          data: { usedCount: { increment: 1 } },
        });
      }

      // 8) Staff
      if (Array.isArray(staff) && staff.length > 0) {
        for (const member of staff) {
          if (!member?.email || !member?.nombre) continue;

          const passwordToUse =
            member.password && member.password.trim() !== ""
              ? member.password
              : randomBytes(18).toString("base64url");

          const staffHash = await bcrypt.hash(passwordToUse, 12);

          await tx.usuario.create({
            data: {
              nombre: member.nombre,
              email: normalizeEmail(member.email),
              hash: staffHash,
              rol: RolUsuario.EMPLEADO,
              activo: true,
              sucursalId: sucursalId,
            },
          });
        }
      }

      return { adminId: mainAdmin.id, subId: sub.id, user: mainAdmin };
    });

    if (!result)
      return jsonError(403, { message: "El sistema ya ha sido inicializado" });
    const { signUserJwt, setAuthCookie } = await import("@/lib/auth/core");
    const token = await signUserJwt({
      sub: String(result.adminId),
      email: result.user.email,
      nombre: result.user.nombre,
      rol: result.user.rol,
      sucursalId: result.user.sucursalId,
    });
    await setAuthCookie(token);

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error("Initialization error FULL:", error);

    return NextResponse.json(
      { message: "Error interno durante la inicialización" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "FATAL: La variable de entorno JWT_SECRET es obligatoria. El servidor no puede iniciar sin ella.",
  );
}
const secret = new TextEncoder().encode(JWT_SECRET);
const cookieName = process.env.JWT_COOKIE_NAME || "access_token";

/* ============================
   SLIDING WINDOW — constantes
   ============================ */

const SESSION_DURATION_S = 60 * 60 * 24 * 7; // 7 días en segundos
const RENEW_THRESHOLD_S = 60 * 60 * 24 * 2; // renovar si quedan < 2 días

/* ============================
   RUTAS PERMITIDAS PARA EMPLEADO
   ============================ */

const EMPLEADO_ALLOWED = [
  "/ventas", // POS y listado de ventas
  "/caja/abrir", // Abrir turno
  "/caja/cerrar", // Cerrar turno
  "/caja/historial", // Historial de caja
];

function isAllowedForEmpleado(pathname: string): boolean {
  return EMPLEADO_ALLOWED.some((route) => pathname.startsWith(route));
}

/* ============================
   MIDDLEWARE
   ============================ */

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(cookieName)?.value;

  if (!token) return NextResponse.next();

  try {
    const { payload } = await jwtVerify(token, secret);
    const rol = payload.rol as string | undefined;
    const exp = payload.exp as number | undefined;

    // ── Control de rol EMPLEADO ──────────────────────────────────────
    if (rol === "EMPLEADO") {
      const pathname = request.nextUrl.pathname;
      if (!isAllowedForEmpleado(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = "/ventas/nueva";
        return NextResponse.redirect(url);
      }
    }

    // ── Sliding window: renovar JWT + cookie si queda < 2 días ───────
    // Aplica solo a cookies persistentes (las que tienen exp en el JWT).
    // Cookies de sesión (sin maxAge, remember=false) no se renuevan —
    // el usuario eligió sesión corta al no marcar "Recordarme".
    const response = NextResponse.next();

    if (exp !== undefined) {
      const nowS = Math.floor(Date.now() / 1000);
      const remainingS = exp - nowS;

      if (remainingS > 0 && remainingS < RENEW_THRESHOLD_S) {
        const {
          sub,
          email,
          rol: payloadRol,
          nombre,
          sucursalId,
        } = payload as {
          sub: string;
          email: string;
          rol: "ADMIN" | "EMPLEADO";
          nombre: string;
          sucursalId: number | null;
        };

        const newToken = await new SignJWT({
          sub,
          email,
          rol: payloadRol,
          nombre,
          sucursalId,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime(`${SESSION_DURATION_S}s`)
          .sign(secret);

        response.cookies.set(cookieName, newToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: SESSION_DURATION_S,
        });
      }
    }

    return response;
  } catch {
    // Token inválido (firma incorrecta, expirado, etc.) → limpiar cookie y redirigir a login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.cookies.set(cookieName, "", { maxAge: 0, path: "/" });
    return response;
  }
}

/* ============================
   MATCHER — Solo rutas protegidas (frontend)
   Excluye: API, _next, archivos estáticos, login
   ============================ */

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clientes/:path*",
    "/productos/:path*",
    "/consignaciones/:path*",
    "/liquidaciones/:path*",
    "/settings/:path*",
    "/ventas/:path*",
    "/caja/:path*",
  ],
};

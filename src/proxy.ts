import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const cookieName = process.env.JWT_COOKIE_NAME || "access_token";

/* ============================
   RUTAS PERMITIDAS PARA EMPLEADO
   ============================ */

const EMPLEADO_ALLOWED = [
    "/ventas",        // POS y listado de ventas (historial de ventas)
    "/caja/abrir",    // Abrir turno
    "/caja/cerrar",   // Cerrar turno
    "/caja/historial",// Historial de caja
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

        if (rol === "EMPLEADO") {
            const pathname = request.nextUrl.pathname;

            if (!isAllowedForEmpleado(pathname)) {
                const url = request.nextUrl.clone();
                url.pathname = "/ventas/nueva";
                return NextResponse.redirect(url);
            }
        }
    } catch {
        // Token inválido → dejar pasar, el layout se encarga de redirigir a login
    }

    return NextResponse.next();
}

/* ============================
   MATCHER — Solo rutas protegidas (frontend)
   Excluye: API, _next, archivos estáticos, login, ticket-loading
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

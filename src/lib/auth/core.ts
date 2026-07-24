import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    "FATAL: La variable de entorno JWT_SECRET es obligatoria. El servidor no puede iniciar sin ella.",
  );
}
const secret = new TextEncoder().encode(JWT_SECRET);
const cookieName = process.env.JWT_COOKIE_NAME || "access_token";

export type JwtPayloadUser = {
  sub: string;
  email: string;
  rol: "ADMIN" | "EMPLEADO";
  nombre: string;
  sucursalId: number | null;
};

/* =========================
   JWT SIGN / VERIFY
========================= */

export async function signUserJwt(payload: JwtPayloadUser) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyUserJwt(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtPayloadUser;
}

/* =========================
   COOKIE HELPERS (ASYNC)
========================= */

export async function setAuthCookie(token: string, remember = true) {
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    // remember=true → persiste 7 días; remember=false → cookie de sesión (se borra al cerrar el navegador)
    ...(remember ? { maxAge: 60 * 60 * 24 * 7 } : {}),
  });
}

/**
 * Renueva la cookie JWT si le quedan menos de SESSION_RENEW_THRESHOLD segundos
 * de vida. Esto implementa un "sliding window" de sesión para todos los navegadores,
 * incluyendo Safari iOS que puede descartar cookies de sesión en background.
 *
 * - Si `remember=true` (cookie persistente): renueva cookie + sesión en DB.
 * - Si `remember=false` (cookie de sesión): no renueva (el usuario quiso sesión corta).
 */
const SESSION_DURATION_S = 60 * 60 * 24 * 7; // 7 días en segundos
const SESSION_RENEW_THRESHOLD_S = 60 * 60 * 24 * 2; // renovar si quedan menos de 2 días

export async function maybeRenewAuthCookie(
  token: string,
  exp: number,
): Promise<void> {
  const nowS = Math.floor(Date.now() / 1000);
  const remainingS = exp - nowS;

  // Solo renovar si tiene maxAge (cookie persistente) y le quedan menos de 2 días
  if (remainingS > SESSION_RENEW_THRESHOLD_S) return;

  const cookieStore = await cookies();

  // Re-setear la misma cookie con maxAge completo renovado
  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_S,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();

  cookieStore.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuthTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName)?.value || null;
}

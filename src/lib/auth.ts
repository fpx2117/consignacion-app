import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const cookieName = process.env.JWT_COOKIE_NAME || "access_token";

export type JwtPayloadUser = {
  sub: string;
  email: string;
  rol: "ADMIN" | "EMPLEADO";
  nombre: string;
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

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
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

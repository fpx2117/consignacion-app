import { createHash } from "crypto";

/**
 * Genera un hash único para una sesión a partir del token JWT.
 * Esto asegura que incluso si el JWT es muy largo, el identificador en DB
 * sea corto (64 chars), indexable y único por cada login.
 */
export function getSessionHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

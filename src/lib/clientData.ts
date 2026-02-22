import { headers as getHeaders } from "next/headers";

export interface RealClientData {
    ip: string;
    userAgent: string;
    browser: string;
    os: string;
    device: string;
}

/**
 * Descubre la IP real y procesa el User Agent
 */
export async function getRealClientData(): Promise<RealClientData> {
    const headersList = await getHeaders();

    // 1. IP Detection (Check common proxy headers)
    const ip =
        headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
        headersList.get("x-real-ip") ||
        headersList.get("cf-connecting-ip") || // Cloudflare
        "127.0.0.1";

    const userAgent = headersList.get("user-agent") || "Unknown";

    // 2. Simple UA Parsing
    let browser = "Otros";
    let os = "Desconocido";
    let device = "Desktop";

    const ua = userAgent.toLowerCase();

    // Browser
    if (ua.includes("chrome") || ua.includes("chromium")) browser = "Chrome";
    else if (ua.includes("firefox")) browser = "Firefox";
    else if (ua.includes("safari")) browser = "Safari";
    else if (ua.includes("edge")) browser = "Edge";
    else if (ua.includes("opera") || ua.includes("opr")) browser = "Opera";

    // OS
    if (ua.includes("windows")) os = "Windows";
    else if (ua.includes("mac os") || ua.includes("macintosh")) os = "macOS";
    else if (ua.includes("android")) os = "Android";
    else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
    else if (ua.includes("linux")) os = "Linux";

    // Device
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
        device = "Mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
        device = "Tablet";
    }

    return { ip, userAgent, browser, os, device };
}

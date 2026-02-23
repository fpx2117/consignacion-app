import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyUserJwt } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const cookieStore = await cookies();
  const cookieName = process.env.JWT_COOKIE_NAME || "access_token";
  const token = cookieStore.get(cookieName)?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    await verifyUserJwt(token);
    redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}

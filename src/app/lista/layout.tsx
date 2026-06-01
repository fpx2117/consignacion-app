import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catálogo online",
};

export default function ListaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

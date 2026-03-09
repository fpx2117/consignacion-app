import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Catalogo online",
};

export default function ListaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

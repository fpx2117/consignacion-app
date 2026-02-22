import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { SocketProvider } from "@/providers/socket-provider";

import { Toaster } from "sonner";
import { SocketToaster } from "../providers/socket-toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Sistema de gestión con MagicUI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* El Provider envuelve todo */}
          <SocketProvider>

            {/* ✅ 2. Colocamos el "Escucha" DENTRO del provider para que acceda al socket */}
            <SocketToaster />

            {children}

            {/* ✅ 3. Colocamos el contenedor visual de las alertas */}
            <Toaster richColors position="top-right" />

          </SocketProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { PerformanceVitals } from "@/components/performance-vitals";

import { Toaster } from "sonner";

const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    {
      path: "../../public/font/Satoshi-Light.woff",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../public/font/Satoshi-Regular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/font/Satoshi-Medium.woff",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/font/Satoshi-Bold.woff",
      weight: "700",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Sistema de gestión con MagicUI",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head />
      <body
        suppressHydrationWarning
        className={`${satoshi.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PerformanceVitals />
          {children}
          <Toaster
            position="bottom-right"
            richColors
            closeButton
            expand={false}
            visibleToasts={3}
            toastOptions={{
              className:
                "!text-sm !font-medium !rounded-xl !shadow-lg !border !border-gray-100",
              duration: 4000,
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

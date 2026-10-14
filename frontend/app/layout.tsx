import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/context/I18nContext";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Acredittia",
  description: "Acreditación de contratistas para faenas mineras y energéticas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-slate-100 text-slate-900 antialiased">
        <I18nProvider>{children}</I18nProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}


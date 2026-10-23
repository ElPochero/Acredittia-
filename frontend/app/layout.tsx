import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/context/I18nContext";
import { Toaster } from "sonner";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
    <html lang="es" className={`${poppins.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-slate-100 text-slate-900 antialiased">
        <I18nProvider>{children}</I18nProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}


"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingFooter — Pie de página oficial de Acredittia.
 * Cumple con R7, H-53, H-54 y H-55:
 * - Todos los href son reales y funcionales (anclas internas, mailto:, enlaces legales).
 * - Cero enlaces de "Sectores" duplicados (H-53).
 * - Aviso de derechos de autor actualizado a "© 2026 ACREDITTIA SpA · Todos los derechos reservados".
 * - Eliminación total del texto de debug "Landing alternativo · v3 · azul + naranja" (H-55).
 * - Enlaces directos a /privacidad y /terminos (H-54).
 * 
 * Referencia HTML: líneas 1739-1771.
 */
export default function LandingFooter() {
  return (
    <footer className="bg-[#0D1B2A] text-white mt-20 pt-16 pb-8 px-[6%] border-t border-slate-800">
      <div className="max-w-[1180px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-10 md:gap-12 pb-12">
          {/* Marca y propuesta */}
          <div className="space-y-4">
            <Link href="/" aria-label="Ir al inicio de Acredittia" className="inline-block">
              <Image
                src="/acredittia-logo.svg"
                alt="ACREDITTIA"
                width={160}
                height={40}
                className="h-8 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-[#9CA5B4] text-xs sm:text-sm leading-relaxed max-w-[360px]">
              La plataforma de acreditación potenciada con IA. Ayudamos a proveedores y faenas a
              acreditar personal, equipos y contratos de forma más rápida y eficiente, con alertas
              preventivas antes de cada vencimiento y gestión multicontrato en un solo lugar.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-[0.7rem] font-semibold text-[#CBD5E1] bg-white/[0.06] border border-[#333B48] px-3 py-1 rounded-full whitespace-nowrap">
                ✦ Potenciado con IA
              </span>
              <span className="text-[0.7rem] font-semibold text-[#CBD5E1] bg-white/[0.06] border border-[#333B48] px-3 py-1 rounded-full whitespace-nowrap">
                🔔 Alertas preventivas
              </span>
              <span className="text-[0.7rem] font-semibold text-[#CBD5E1] bg-white/[0.06] border border-[#333B48] px-3 py-1 rounded-full whitespace-nowrap">
                📑 Gestión multicontrato
              </span>
            </div>
          </div>

          {/* Columna Explorar (H-53: anclas únicas y sin duplicados) */}
          <div>
            <h4 className="text-[0.72rem] font-bold tracking-widest uppercase text-[#6B7686] mb-4">
              Explorar
            </h4>
            <ul className="space-y-2.5 text-sm text-[#CBD5E1]">
              <li>
                <a
                  href={`#${LANDING_SECTIONS.FLUJO}`}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Cómo funciona
                </a>
              </li>
              <li>
                <a
                  href={`#${LANDING_SECTIONS.PLATAFORMA}`}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Plataforma
                </a>
              </li>
              <li>
                <a
                  href={`#${LANDING_SECTIONS.AGENTES}`}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Agentes
                </a>
              </li>
              <li>
                <a
                  href={`#${LANDING_SECTIONS.FAENAS}`}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Faenas
                </a>
              </li>
              <li>
                <a
                  href={`#${LANDING_SECTIONS.BENEFICIADOS}`}
                  className="hover:text-white hover:underline transition-colors"
                >
                  Quién se beneficia
                </a>
              </li>
            </ul>
          </div>

          {/* Columna Contacto y Legales (H-54: href reales funcionales) */}
          <div>
            <h4 className="text-[0.72rem] font-bold tracking-widest uppercase text-[#6B7686] mb-4">
              Contacto y Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-[#CBD5E1]">
              <li>
                <a
                  href={`#${LANDING_SECTIONS.CONTACT}`}
                  className="hover:text-white hover:underline transition-colors font-medium text-white"
                >
                  Agendar demo →
                </a>
              </li>
              <li>
                <a
                  href="mailto:acredittia.contacto@gmail.com"
                  className="hover:text-white hover:underline transition-colors break-all"
                >
                  acredittia.contacto@gmail.com
                </a>
              </li>
              <li className="pt-2 border-t border-[#333B48]/60">
                <Link
                  href="/privacidad"
                  className="text-xs text-[#9CA5B4] hover:text-white hover:underline transition-colors"
                >
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link
                  href="/terminos"
                  className="text-xs text-[#9CA5B4] hover:text-white hover:underline transition-colors"
                >
                  Términos y condiciones
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Barra inferior de copyright (H-55: © 2026 sin "v3 · azul + naranja") */}
        <div className="border-t border-[#333B48] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6B7686]">
          <span>© 2026 ACREDITTIA SpA · Todos los derechos reservados</span>
          <span className="text-[0.7rem] text-[#4B5563]">
            Acreditación inteligente para la minería y energía
          </span>
        </div>
      </div>
    </footer>
  );
}

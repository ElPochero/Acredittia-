"use client";

import React from "react";
import Image from "next/image";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingBeneficiados — Sección "Quién se ve beneficiado" (Mandante + 3 Proveedores).
 * Cumple con R6, H-44, H-28 y H-43:
 * - Tarjetas con fotos locales, etiquetas contextuales y contraste WCAG AA.
 * - Tarjetas de proveedores con altura uniforme (h-full y flex-col) para evitar desajustes visuales (H-44).
 * - Identificador de ancla canónico 'beneficiados' mapeado a sections.ts.
 * 
 * Referencia HTML: líneas 1610-1645.
 */
export default function LandingBeneficiados() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      id={LANDING_SECTIONS.BENEFICIADOS}
      ref={sectionRef}
      className="pt-20 sm:pt-28 pb-10 sm:pb-14 px-[6%] bg-white scroll-mt-20"
    >
      <div className="max-w-[1080px] mx-auto">
        {/* Cabecera */}
        <div className="text-center mb-12 sm:mb-14">
          <div className="inline-flex items-center justify-center gap-2 text-[0.72rem] tracking-wider uppercase font-bold text-landing-azul bg-landing-azul-claro px-3.5 py-1.5 rounded-full mb-3.5">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            A QUIÉN AYUDA
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold text-landing-ink tracking-tight mb-3">
            Todos ganan cuando la acreditación funciona
          </h2>
          <p className="text-landing-gris text-base sm:text-lg max-w-[620px] mx-auto leading-relaxed">
            No depende de una sola persona: pasa por la faena, por la empresa proveedora y por el propio trabajador.
          </p>
        </div>

        {/* Grupo Mandante */}
        <div className="flex items-center gap-3 text-xs sm:text-sm text-landing-gris mb-3.5">
          <span className="font-mono text-[0.68rem] font-bold tracking-wider uppercase bg-landing-azul-claro text-landing-azul-d px-3 py-1 rounded-full shrink-0">
            Mandante
          </span>
          <span>Trabaja directamente en la faena, no es parte de la empresa proveedora</span>
        </div>

        {/* Tarjeta destacada Mandante */}
        <div className="mb-10 border border-landing-linea rounded-[20px] overflow-hidden bg-white shadow-landing-card">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr]">
            <div className="relative h-[220px] md:h-auto min-h-[220px]">
              <Image
                src="/who_faena_crop.jpg"
                alt="Área de Prevención de la faena"
                fill
                sizes="(max-width: 768px) 100vw, 450px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-900/30" />
              <span className="absolute bottom-3.5 left-4 z-10 text-white font-extrabold text-sm sm:text-base drop-shadow-sm">
                Área de Prevención de la faena
              </span>
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-center space-y-3.5 text-xs sm:text-sm text-landing-gris leading-relaxed bg-white">
              <div className="flex items-start gap-3">
                <span className="text-landing-azul font-black text-sm shrink-0 mt-0.5">→</span>
                <p>
                  Al integrar la faena a ACREDITTIA, el área de prevención deja de contestar cientos de consultas repetidas de sus proveedores sobre requisitos y vigencias: los requisitos quedan mapeados en la plataforma, junto con los correos de contacto para solicitar accesos, así la acreditación de cada proveedor es más fluida y sin tanta consulta de por medio.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-landing-azul font-black text-sm shrink-0 mt-0.5">→</span>
                <p>
                  Sus proveedores reciben alertas de vencimiento antes de que un documento expire, evitando paralizaciones que le cuestan dinero a la propia faena por no poder producir.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-landing-azul font-black text-sm shrink-0 mt-0.5">→</span>
                <p>
                  Tiene visibilidad total de todos los proveedores de la faena y de cada documento que han subido, sin tener que pedirlo ni perseguir a nadie.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Grupo Proveedor */}
        <div className="flex items-center gap-3 text-xs sm:text-sm text-landing-gris mb-3.5 mt-8">
          <span className="font-mono text-[0.68rem] font-bold tracking-wider uppercase bg-landing-naranja-claro text-landing-naranja-d px-3 py-1 rounded-full shrink-0">
            Proveedor
          </span>
          <span>Trabajan en la empresa que presta servicios a la faena</span>
        </div>

        {/* Grilla 3 tarjetas de altura uniforme (H-44) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Tarjeta 1: Jefe de Acreditaciones */}
          <div className="border border-landing-linea rounded-[20px] overflow-hidden bg-white shadow-landing-card flex flex-col h-full">
            <div className="relative h-[190px] w-full shrink-0">
              <Image
                src="/who_jefe.jpeg"
                alt="Jefe de Acreditaciones"
                fill
                sizes="(max-width: 768px) 100vw, 340px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
              <span className="absolute bottom-3.5 left-4 z-10 text-white font-extrabold text-sm sm:text-base drop-shadow-sm">
                Jefe de Acreditaciones
              </span>
            </div>
            <div className="p-6 flex-1 flex items-start gap-3 text-xs sm:text-sm text-landing-gris leading-relaxed">
              <span className="text-landing-azul font-black text-sm shrink-0 mt-0.5">→</span>
              <p>
                Ve todos los contratos que tiene la empresa en un solo panel y les da seguimiento, sin perseguir el dato en cada plataforma del mandante.
              </p>
            </div>
          </div>

          {/* Tarjeta 2: Administrador de Contrato */}
          <div className="border border-landing-linea rounded-[20px] overflow-hidden bg-white shadow-landing-card flex flex-col h-full">
            <div className="relative h-[190px] w-full shrink-0">
              <Image
                src="/who_adc.png"
                alt="Administrador de Contrato"
                fill
                sizes="(max-width: 768px) 100vw, 340px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
              <span className="absolute bottom-3.5 left-4 z-10 text-white font-extrabold text-sm sm:text-base drop-shadow-sm">
                Administrador de Contrato
              </span>
            </div>
            <div className="p-6 flex-1 flex items-start gap-3 text-xs sm:text-sm text-landing-gris leading-relaxed">
              <span className="text-landing-azul font-black text-sm shrink-0 mt-0.5">→</span>
              <p>
                Administra la acreditación de su contrato desde ahí, y el líder del área de prevención de la faena puede tener visibilidad de ese contrato en cualquier momento.
              </p>
            </div>
          </div>

          {/* Tarjeta 3: Trabajador */}
          <div className="border border-landing-linea rounded-[20px] overflow-hidden bg-white shadow-landing-card flex flex-col h-full">
            <div className="relative h-[190px] w-full shrink-0">
              <Image
                src="/who_trabajador.jpeg"
                alt="Trabajador"
                fill
                sizes="(max-width: 768px) 100vw, 340px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
              <span className="absolute bottom-3.5 left-4 z-10 text-white font-extrabold text-sm sm:text-base drop-shadow-sm">
                Trabajador
              </span>
            </div>
            <div className="p-6 flex-1 flex items-start gap-3 text-xs sm:text-sm text-landing-gris leading-relaxed">
              <span className="text-landing-azul font-black text-sm shrink-0 mt-0.5">→</span>
              <p>
                Envía sus documentos por WhatsApp, sin fricción humana, se cargan de inmediato a la plataforma.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

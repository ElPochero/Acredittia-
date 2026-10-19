"use client";

import React from "react";
import Image from "next/image";
import useReveal from "./useReveal";

interface PersonaCard {
  title: string;
  description: string;
  image: string;
  alt: string;
}

const PERSONAS: PersonaCard[] = [
  {
    title: "Para la faena / mandante",
    description: "Monitoreo automático y un Agente IA que guía a cada proveedor. Nadie llega a garita con un documento vencido.",
    image: "/who_faena_crop.jpg",
    alt: "Operación en faena minera y mandante",
  },
  {
    title: "Para la empresa proveedora",
    description: "Acreditación más rápida, sin adivinar qué exige cada faena. Gestiona todo desde un solo lugar.",
    image: "/whoq_proveedor.jpeg",
    alt: "Empresa contratista y proveedora",
  },
];

/**
 * LandingParaQuien — Banda oscura orientada a mandantes y proveedores (Día 2, líneas 955-980).
 * - 2 tarjetas fotográficas con degradado oscuro de fondo y microinteracción hover.
 * - Animación sutil con useReveal.
 */
export default function LandingParaQuien() {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <section className="py-20 lg:py-28 px-[6%] bg-[#0D1B2A] text-white">
      <div className="max-w-[1080px] mx-auto" ref={revealRef}>
        {/* Encabezado */}
        <div className="max-w-[640px] mx-auto text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 text-[#8FB8FF] font-bold text-[0.82rem] tracking-wider uppercase mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#8FB8FF]" />
            <span>PARA QUIÉN ES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-[-0.01em] text-white mb-4 font-landing-sans leading-[1.2]">
            Descubre cómo ACREDITTIA impulsa tu operación
          </h2>
          <p className="text-slate-300 text-base sm:text-[1.02rem] leading-[1.6]">
            La faena nunca se atrasa. El proveedor nunca pierde tiempo persiguiendo documentos.
          </p>
        </div>

        {/* Grilla de 2 tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {PERSONAS.map((persona) => (
            <div
              key={persona.title}
              className="group relative rounded-3xl overflow-hidden aspect-[1/0.95] sm:aspect-[1/0.9] border border-slate-700 shadow-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] cursor-default"
            >
              {/* Imagen de fondo con escala en hover */}
              <Image
                src={persona.image}
                alt={persona.alt}
                fill
                sizes="(max-width: 768px) 100vw, 540px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />

              {/* Degradado oscuro para legibilidad */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A] via-[#0D1B2A]/60 to-transparent"
                aria-hidden="true"
              />

              {/* Botón flotante de flecha */}
              <div
                className="absolute top-4 right-4 sm:top-5 sm:right-5 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 backdrop-blur-md text-white flex items-center justify-center text-lg shadow-lg border border-white/10 transition-all duration-300 group-hover:bg-landing-azul group-hover:rotate-45 z-10"
                aria-hidden="true"
              >
                →
              </div>

              {/* Textos descriptivos */}
              <div className="absolute left-6 right-6 bottom-6 sm:left-8 sm:right-8 sm:bottom-8 z-10 text-white">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white mb-2 leading-snug">
                  {persona.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-200 leading-[1.6]">
                  {persona.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

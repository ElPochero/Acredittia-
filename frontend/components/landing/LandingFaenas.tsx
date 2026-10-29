"use client";

import React from "react";
import Image from "next/image";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

interface FaenaItem {
  id: string;
  name: string;
  client: string;
  image: string;
  alt: string;
}

const FAENAS: FaenaItem[] = [
  {
    id: "los-pelambres",
    name: "Los Pelambres",
    client: "Antofagasta Minerals",
    image: "/los_pelambres.jpeg",
    alt: "Faena Los Pelambres - Antofagasta Minerals",
  },
  {
    id: "centinela",
    name: "Centinela",
    client: "Antofagasta Minerals",
    image: "/centinela.jpg",
    alt: "Faena Centinela - Antofagasta Minerals",
  },
  {
    id: "antucoya",
    name: "Antucoya",
    client: "Antofagasta Minerals",
    image: "/antucoya.jpg",
    alt: "Faena Antucoya - Antofagasta Minerals",
  },
  {
    id: "zaldivar",
    name: "Zaldívar",
    client: "Antofagasta Minerals",
    image: "/zaldivar.png",
    alt: "Faena Zaldívar - Antofagasta Minerals",
  },
  {
    id: "candelaria",
    name: "Candelaria",
    client: "Lundin Mining",
    image: "/candelaria.jpg",
    alt: "Faena Candelaria - Lundin Mining",
  },
  {
    id: "caserones",
    name: "Caserones",
    client: "Lundin Mining",
    image: "/caserones.jpeg",
    alt: "Faena Caserones - Lundin Mining",
  },
  {
    id: "el-teniente",
    name: "El Teniente",
    client: "Codelco",
    image: "/el_teniente.jpg",
    alt: "Faena El Teniente - Codelco",
  },
  {
    id: "andina",
    name: "Andina",
    client: "Codelco",
    image: "/andina.jpg",
    alt: "Faena Andina - Codelco",
  },
  {
    id: "antofagasta-1",
    name: "P. Eólico Antofagasta I",
    client: "Repsol",
    image: "/antofagastaI.jpg",
    alt: "Parque Eólico Antofagasta I - Repsol",
  },
];

/**
 * LandingFaenas — Grilla estática de 9 faenas integradas + 1 CTA real bajo la grilla.
 * Cierra H-11 (tarjetas no clicables sin apariencia falsa de botón), H-12 (grilla estática uniforme con aspect-ratio 16/10)
 * y H-13 (párrafo descriptivo presente y verificado).
 * Referencia HTML: líneas 1552-1570.
 */
export default function LandingFaenas() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      id={LANDING_SECTIONS.FAENAS}
      className="py-24 px-[6%] bg-white border-t border-landing-linea scroll-mt-20"
      aria-label="Faenas integradas en ACREDITTIA"
    >
      <div className="max-w-[640px] mx-auto text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-landing-azul" />
          DÓNDE TRABAJAMOS
        </div>
        <h2 className="text-2xl md:text-[2.1rem] font-extrabold tracking-tight text-landing-ink mb-3.5 leading-tight">
          9 faenas ya integradas
        </h2>
        <p className="text-landing-gris text-base md:text-[1rem] leading-relaxed">
          Flujo y plataforma completamente mapeados. Integración directa, sin pasos manuales.
        </p>
      </div>

      {/* Grilla uniforme de 9 faenas (no clicables, sin affordance interactivo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-[1000px] mx-auto">
        {FAENAS.map((faena) => (
          <div
            key={faena.id}
            className="relative rounded-2xl overflow-hidden aspect-[16/10] bg-landing-ink shadow-sm border border-landing-linea/40 select-none cursor-default"
          >
            {/* Imagen de la faena */}
            <Image
              src={faena.image}
              alt={faena.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 333px"
              className="object-cover"
            />

            {/* Sombra inferior para garantizar contraste */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent z-10 pointer-events-none"
              aria-hidden="true"
            />

            {/* Identificación de la faena y mandante */}
            <div className="absolute bottom-3.5 left-4 right-4 z-20 text-white">
              <b className="block text-[0.92rem] font-extrabold leading-snug drop-shadow-sm">
                {faena.name}
              </b>
              <span className="block text-[0.7rem] text-[#CBD5E1] mt-0.5">
                {faena.client}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* CTA real y funcional bajo la grilla (H-11) */}
      <div className="mt-12 text-center">
        <p className="text-landing-gris text-sm mb-3.5">
          ¿Tu faena o mandante no aparece en la lista?
        </p>
        <a
          href={`#${LANDING_SECTIONS.CONTACT}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-landing-azul hover:bg-landing-azul-d text-white font-bold text-sm shadow-md transition-colors"
        >
          <span>Consultar por tu faena</span>
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}

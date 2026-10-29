"use client";

import React, { useState } from "react";
import Image from "next/image";
import useReveal from "./useReveal";

interface IndustriaItem {
  id: string;
  name: string;
  image: string;
  alt: string;
  gradient: string;
}

const INDUSTRIAS: IndustriaItem[] = [
  {
    id: "ind-mineria",
    name: "Minería",
    image: "/los_pelambres.jpeg",
    alt: "Operación de faena minera en Chile",
    gradient: "from-[#0F172A] via-[#1E293B] to-[#334155]",
  },
  {
    id: "ind-energia",
    name: "Energía",
    image: "/tipo_fotovoltaica.jpeg",
    alt: "Parque de generación fotovoltaica",
    gradient: "from-[#0C1E3C] via-[#153460] to-[#1E4E8C]",
  },
  {
    id: "ind-eolica",
    name: "Eólica",
    image: "/tipo_aerogenerador.jpeg",
    alt: "Aerogeneradores en parque eólico",
    gradient: "from-[#0A2540] via-[#14426E] to-[#1E6091]",
  },
  {
    id: "ind-construccion",
    name: "Construcción",
    image: "/whoq_faena.jpeg",
    alt: "Obra de construcción e infraestructura",
    gradient: "from-[#1F2421] via-[#363F39] to-[#4F5D54]",
  },
  {
    id: "ind-agro",
    name: "Agropecuario",
    image: "/tipo_cosechadora.jpeg",
    alt: "Maquinaria agrícola en faena agropecuaria",
    gradient: "from-[#142C1F] via-[#244C36] to-[#346C4E]",
  },
  {
    id: "ind-salmon",
    name: "Salmonicultura",
    image: "/tipo_embarcacion.jpeg",
    alt: "Centro de cultivo y embarcación de salmonicultura",
    gradient: "from-[#0A192F] via-[#172A45] to-[#203A43]",
  },
];

/**
 * LandingIndustrias — Muestra 6 industrias con fotos locales de alta calidad y fallback de degradado garantizado.
 * Cierra H-39 (imágenes locales con fallback visual que nunca muestra ícono roto),
 * H-14 (sin affordance interactivo falso) y H-45 (sin mapa global redundante).
 * Referencia HTML: líneas 1113-1140.
 */
export default function LandingIndustrias() {
  const sectionRef = useReveal<HTMLElement>();
  // Estado para capturar posibles errores de carga de imagen y activar el degradado de respaldo
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (id: string) => {
    setImageErrors((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <section
      ref={sectionRef}
      id="industrias"
      className="pt-24 pb-32 px-[3%] bg-white scroll-mt-20"
      aria-label="Industrias con proveedores que requieren acreditación"
    >
      <div className="max-w-[640px] mx-auto px-4 text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-landing-azul" />
          PARA CUALQUIER INDUSTRIA CON PROVEEDORES
        </div>
        <h2 className="text-2xl md:text-[2.1rem] font-extrabold tracking-tight text-landing-ink mb-3.5 leading-tight">
          No importa tu rubro, el problema es el mismo
        </h2>
        <p className="text-landing-gris text-base md:text-[1rem] leading-relaxed">
          Minería, energía, construcción, agro o pesca: en cualquier industria, los proveedores deben acreditar antes de operar.
        </p>
      </div>

      <div className="max-w-[1320px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {INDUSTRIAS.map((item) => {
          const hasError = imageErrors[item.id];

          return (
            <div
              key={item.id}
              className="relative rounded-[20px] overflow-hidden shadow-[0_18px_38px_-22px_rgba(13,27,42,0.32)] transition-all duration-300 min-h-[360px] md:min-h-[440px] select-none bg-landing-ink group"
            >
              {/* Fallback de degradado siempre presente como fondo */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${item.gradient} transition-opacity duration-500`}
                aria-hidden="true"
              />

              {/* Imagen local optimizada — se oculta si hay error para asegurar que nunca se ve ícono roto */}
              {!hasError && (
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 440px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={() => handleImageError(item.id)}
                />
              )}

              {/* Capa de sombra inferior para asegurar contraste accesible del titular */}
              <div
                className="absolute inset-0 bg-gradient-to-t from-landing-ink/85 via-landing-ink/20 to-transparent z-10 pointer-events-none"
                aria-hidden="true"
              />

              {/* Contenido textual inferior */}
              <div className="absolute left-6 right-6 bottom-8 z-20 text-white">
                <b className="block text-2xl md:text-[1.7rem] font-extrabold leading-tight tracking-tight drop-shadow-sm">
                  {item.name}
                </b>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

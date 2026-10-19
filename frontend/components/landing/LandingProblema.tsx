"use client";

import React from "react";
import useReveal from "./useReveal";

interface ProblemCard {
  icon: string;
  title: string;
  description: string;
}

const PROBLEMS: ProblemCard[] = [
  {
    icon: "🗂️",
    title: "5+ sistemas distintos",
    description: "SIGA, Webcontrol, Sucal, Metacontratas, planillas Excel — cada uno con su propio inicio de sesión y formato.",
  },
  {
    icon: "⏱️",
    title: "Horas armando reportes a mano",
    description: "Antes de cada ingreso a faena, alguien revisa carpeta por carpeta qué está vigente y qué no.",
  },
  {
    icon: "🚧",
    title: "Riesgo de atraso en la faena",
    description: "Un solo documento vencido puede dejar a un trabajador o un equipo fuera, justo el día que debía entrar.",
  },
];

/**
 * LandingProblema — Sección de diagnóstico y puntos de dolor (Día 2, líneas 781-805).
 * - 3 tarjetas explicativas con íconos representativos.
 * - Animación sutil con useReveal.
 */
export default function LandingProblema() {
  const revealRef = useReveal<HTMLDivElement>();

  return (
    <section className="py-20 lg:py-28 px-[6%] bg-white border-b border-landing-linea">
      <div className="max-w-[1080px] mx-auto" ref={revealRef}>
        {/* Encabezado */}
        <div className="max-w-[640px] mx-auto text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 text-landing-azul font-bold text-[0.82rem] tracking-wider uppercase mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-landing-azul" />
            <span>EL PROBLEMA</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.5rem] font-extrabold tracking-[-0.01em] text-landing-ink mb-4 font-landing-sans leading-[1.2]">
            Tu dotación está lista. Tu documentación, no.
          </h2>
          <p className="text-landing-gris text-base sm:text-[1.02rem] leading-[1.6]">
            Los documentos viven repartidos entre planillas, correos y la plataforma de cada mandante. Nadie sabe con certeza quién puede entrar a la faena hoy.
          </p>
        </div>

        {/* Grilla de 3 tarjetas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROBLEMS.map((problem) => (
            <div
              key={problem.title}
              className="bg-landing-soft rounded-2xl p-6 sm:p-7 border border-landing-linea hover:shadow-landing-card transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-white border border-landing-linea flex items-center justify-center text-xl mb-4 shadow-sm">
                {problem.icon}
              </div>
              <b className="block text-[1.05rem] font-extrabold text-landing-ink mb-2">
                {problem.title}
              </b>
              <span className="block text-sm text-landing-gris leading-[1.6]">
                {problem.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

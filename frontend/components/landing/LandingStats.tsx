"use client";

import React, { useState, useEffect, useRef } from "react";
import useReveal from "./useReveal";

interface StatItem {
  target?: number;
  staticVal?: string;
  prefix?: string;
  suffix?: string;
  explanation: string;
}

const STATS: StatItem[] = [
  { target: 9, suffix: "", explanation: "Faenas ya integradas" },
  { target: 100, suffix: "%", explanation: "Documentos centralizados en un solo lugar" },
  { staticVal: "24/7", explanation: "Agentes IA dando seguimiento por WhatsApp" },
  { target: 80, prefix: "-", suffix: "%", explanation: "Reducción en el tiempo dedicado a la acreditación" },
];

/**
 * LandingStats — Sección de métricas de impacto con contadores animados (Día 2, líneas 982-990).
 * - Animación de conteo suave de 1.100 ms que se dispara una sola vez al entrar en vista.
 * - Respeto estricto de prefers-reduced-motion (muestra valores finales directamente).
 * - Cada métrica muestra valor + unidad + explicación (Criterio Día 2, H-28, H-46).
 */
export default function LandingStats() {
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0]);
  const hasAnimatedRef = useRef(false);

  const startAnimation = () => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCounts(STATS.map((s) => s.target || 0));
      return;
    }

    const start = performance.now();
    const duration = 1100;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);

      setCounts(
        STATS.map((stat) => {
          if (!stat.target) return 0;
          return Math.round(eased * stat.target);
        })
      );

      if (p < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  };

  const revealRef = useReveal<HTMLDivElement>(startAnimation);

  return (
    <section className="py-20 lg:py-24 px-[6%] bg-landing-soft border-b border-landing-linea">
      <div className="max-w-[1120px] mx-auto" ref={revealRef}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((stat, idx) => {
            const displayValue = stat.staticVal
              ? stat.staticVal
              : `${stat.prefix || ""}${counts[idx]}${stat.suffix || ""}`;

            return (
              <div key={stat.explanation} className="flex flex-col items-center">
                <b className="block text-4xl sm:text-5xl lg:text-[3.2rem] font-bold text-landing-ink leading-none mb-3 font-landing-sans tracking-tight">
                  {displayValue}
                </b>
                <span className="block text-sm sm:text-[0.92rem] font-semibold text-landing-gris max-w-[220px] mx-auto leading-[1.5]">
                  {stat.explanation}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

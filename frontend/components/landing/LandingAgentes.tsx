"use client";

import React, { useState, useEffect } from "react";
import useReveal from "./useReveal";
import { LANDING_SECTIONS } from "./sections";

interface ChatMessage {
  type: "in" | "out";
  text: string;
}

const SCENARIOS: ChatMessage[][] = [
  [
    {
      type: "in",
      text: "Hola Rodrigo 👋 tu licencia de conducir vence en 10 días. ¿Puedes subir la foto de la nueva?",
    },
    {
      type: "out",
      text: "Sí, aquí va 📎",
    },
    {
      type: "in",
      text: "✅ Documento recibido y validado. Contrato al día.",
    },
  ],
  [
    {
      type: "in",
      text: "Hola Marcela 👋 tu examen ocupacional vence pronto. Tengo hora el jueves 10:00 en Clínica Vespucio, ¿te la agendo?",
    },
    {
      type: "out",
      text: "Dale, resérvala 👍",
    },
    {
      type: "in",
      text: "✅ Examen agendado para el jueves 10:00. Te aviso un día antes.",
    },
  ],
  [
    {
      type: "in",
      text: "Hola José 👋 tu curso de trabajo en altura vence este mes. Hay cupo el lunes 09:00, ¿te inscribo?",
    },
    {
      type: "out",
      text: "Sí, inscríbeme 🙌",
    },
    {
      type: "in",
      text: "✅ Inscripción confirmada. El certificado se sube solo al terminar.",
    },
  ],
];

/**
 * LandingAgentes — Sección Módulo Agentes con chat WhatsApp interactivo y 3 escenarios rotativos reales.
 * Cierra H-20 (rotación real de escenarios de chat) y H-32 (vistas con contenido verificado).
 * Cumple WCAG 2.2.2 (control de pausa de rotación automática).
 * Referencia HTML: líneas 1572-1593 y 1917-1954.
 */
export default function LandingAgentes() {
  const sectionRef = useReveal<HTMLElement>();

  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(3);
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, []);

  const shouldAutoplay = !isManualPaused && !isHovered && !isFocused && !prefersReducedMotion;

  useEffect(() => {
    if (!shouldAutoplay) {
      setVisibleCount(3);
      return;
    }

    // Iniciar secuencia escalonada del escenario actual
    setVisibleCount(1);
    const t1 = setTimeout(() => setVisibleCount(2), 1100);
    const t2 = setTimeout(() => setVisibleCount(3), 2200);

    // Avanzar al siguiente escenario tras pausa de lectura
    const t3 = setTimeout(() => {
      setScenarioIndex((prev) => (prev + 1) % SCENARIOS.length);
    }, 6000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [scenarioIndex, shouldAutoplay]);

  const currentMessages = SCENARIOS[scenarioIndex];

  return (
    <section
      ref={sectionRef}
      id={LANDING_SECTIONS.AGENTES}
      className="py-24 px-[6%] bg-landing-ink text-white border-t border-[#1E293B] scroll-mt-20"
      aria-label="Módulo de agentes IA para acreditación"
    >
      <div className="max-w-[1080px] mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-14 items-center">
        {/* Columna Izquierda: Copy + Bullets */}
        <div>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[#9CC1FF] font-bold text-[0.74rem] tracking-wider uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-[#9CC1FF]" />
            MÓDULO AGENTES
          </span>
          <h2 className="text-2xl md:text-[2.1rem] font-extrabold tracking-tight mb-4 leading-tight">
            Agentes que hacen el seguimiento por ti
          </h2>
          <p className="text-[#9CA5B4] text-base md:text-[1rem] leading-relaxed mb-8">
            Además de todas las alertas y el control centralizado, creas Agentes IA que hablan directo con cada trabajador, para que el encargado de acreditación deje de andar llamando a nadie.
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 text-[0.88rem] text-[#CBD5E1] leading-relaxed">
              <span className="text-[#8FB8FF] font-extrabold text-base shrink-0" aria-hidden="true">
                →
              </span>
              <span>
                Piden documentos automáticamente: carnet, licencia, exámenes y más.
              </span>
            </div>
            <div className="flex items-start gap-3 text-[0.88rem] text-[#CBD5E1] leading-relaxed">
              <span className="text-[#8FB8FF] font-extrabold text-base shrink-0" aria-hidden="true">
                →
              </span>
              <span>
                Hablan directo con el trabajador por WhatsApp, el canal que ya usa todos los días.
              </span>
            </div>
            <div className="flex items-start gap-3 text-[0.88rem] text-[#CBD5E1] leading-relaxed">
              <span className="text-[#8FB8FF] font-extrabold text-base shrink-0" aria-hidden="true">
                →
              </span>
              <span>
                Trabajan 24/7. El encargado ya no tiene que perseguir a nadie por teléfono.
              </span>
            </div>
          </div>
        </div>

        {/* Columna Derecha: Mockup Chat WhatsApp */}
        <div
          className="bg-[#242A3480] border border-[#333B48] rounded-[20px] p-5 sm:p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-sm"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Encabezado del chat */}
          <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#333B48]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-sm shrink-0 shadow-sm">
                🤖
              </div>
              <div>
                <b className="block text-[0.88rem] text-[#F1F5F9] font-bold leading-tight">
                  Agente Acreditador IA
                </b>
                <span className="block text-[0.72rem] text-[#25D366] font-semibold">
                  ● Activo por WhatsApp
                </span>
              </div>
            </div>

            {/* Control de pausa accesible */}
            <button
              type="button"
              onClick={() => setIsManualPaused((prev) => !prev)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              aria-label={isManualPaused ? "Reanudar rotación del chat" : "Pausar rotación del chat"}
              title={isManualPaused ? "Reanudar chat" : "Pausar chat"}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.68rem] font-medium text-[#9CA5B4] hover:text-white bg-white/5 hover:bg-white/10 border border-[#333B48] transition-colors"
            >
              <span aria-hidden="true">{isManualPaused ? "▶" : "⏸"}</span>
              <span className="hidden sm:inline">{isManualPaused ? "Reanudar" : "Pausar"}</span>
            </button>
          </div>

          {/* Mensajes del chat */}
          <div className="min-h-[200px] flex flex-col justify-end" role="log" aria-live="polite">
            {currentMessages.map((msg, idx) => {
              const isVisible = idx < visibleCount || prefersReducedMotion;

              return (
                <div
                  key={`${scenarioIndex}-${idx}`}
                  className={`transition-all duration-500 ease-out ${
                    isVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-2 pointer-events-none"
                  }`}
                >
                  {msg.type === "in" ? (
                    <div className="bg-[#2E3542] text-[#E2E8F0] rounded-[14px_14px_14px_4px] p-3 text-[0.82rem] leading-relaxed max-w-[88%] mb-2.5 shadow-sm">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="bg-[#25D366] text-[#04210F] font-semibold rounded-[14px_14px_4px_14px] p-3 text-[0.82rem] leading-relaxed max-w-[88%] ml-auto mb-2.5 shadow-sm">
                      {msg.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

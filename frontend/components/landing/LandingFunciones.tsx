"use client";

import React, { useEffect, useState, useRef } from "react";
import useReveal from "./useReveal";
import { IconMail, IconDocument } from "./LandingIcons";

const PLATFORMS = ["SIGA", "Workmate", "Webcontrol", "Metacontratas", "SUCAL"];

/**
 * LandingFunciones — 6 funcionalidades centrales con demos embebidas y rotación de plataformas.
 * Cierra H-14 (sin affordances falsos), H-19 (microinteracciones reales) y H-36 (mensajes concisos).
 * Referencia HTML: líneas 992-1055 y 2000-2015.
 */
export default function LandingFunciones() {
  const sectionRef = useReveal<HTMLElement>();

  // Estado para la rotación del chip de plataformas (Item 03)
  const [platIndex, setPlatIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
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

  const shouldRotate = !isManualPaused && !isHovered && !isFocused && !prefersReducedMotion;

  useEffect(() => {
    if (!shouldRotate) return;

    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setPlatIndex((prev) => (prev + 1) % PLATFORMS.length);
        setIsFading(false);
      }, 300);
    }, 2200);

    return () => clearInterval(interval);
  }, [shouldRotate]);

  return (
    <section
      ref={sectionRef}
      className="py-24 px-[6%] bg-white border-t border-landing-linea scroll-mt-20"
      aria-label="Funcionalidades de ACREDITTIA"
    >
      <div className="max-w-[640px] mx-auto text-center mb-14">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
          <span className="w-2 h-2 rounded-full bg-landing-azul" />
          FUNCIONALIDADES
        </div>
        <h2 className="text-2xl md:text-[2.1rem] font-extrabold tracking-tight text-landing-ink mb-3.5 leading-tight">
          Todo lo que hoy vive disperso en Excel, en un solo lugar
        </h2>
        <p className="text-landing-gris text-base md:text-[1rem] leading-relaxed">
          La IA lee, vigila y avisa. Tú solo revisas lo que de verdad importa.
        </p>
      </div>

      <div className="max-w-[980px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
        {/* 01 — Alertas automáticas por correo */}
        <div className="flex gap-4 items-start">
          <div className="w-[42px] h-[42px] rounded-xl bg-landing-azul-claro text-landing-azul font-extrabold text-base flex items-center justify-center shrink-0">
            01
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-[1rem] text-landing-ink mb-1.5">
              Alertas automáticas por correo
            </h3>
            <p className="text-landing-gris text-[0.86rem] leading-relaxed">
              Antes de que un documento caduque, ya tienes el correo con el aviso.
            </p>
            <div className="bg-landing-soft border border-landing-linea rounded-xl p-3.5 mt-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-landing-linea flex items-center justify-center text-landing-azul shrink-0 animate-fe-icon-pulse">
                  <IconMail className="w-4 h-4 text-landing-azul" />
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block text-[0.78rem] font-extrabold text-landing-ink leading-snug truncate">
                    ACREDITTIA
                  </b>
                  <span className="block text-[0.72rem] text-landing-gris leading-snug truncate">
                    Tu licencia de conducir vence en 5 días, sube la renovación
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 02 — Documentos centralizados */}
        <div className="flex gap-4 items-start">
          <div className="w-[42px] h-[42px] rounded-xl bg-landing-azul-claro text-landing-azul font-extrabold text-base flex items-center justify-center shrink-0">
            02
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-[1rem] text-landing-ink mb-1.5">
              Documentos centralizados
            </h3>
            <p className="text-landing-gris text-[0.86rem] leading-relaxed">
              Sube cada certificado una sola vez y reutilízalo en todas las faenas que lo pidan.
            </p>
            <div className="bg-landing-soft border border-landing-linea rounded-xl p-3.5 mt-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-landing-linea flex items-center justify-center text-landing-azul shrink-0 animate-fe-icon-pulse">
                  <IconDocument className="w-4 h-4 text-landing-azul" />
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block text-[0.78rem] font-extrabold text-landing-ink leading-snug truncate">
                    Certificado ISO 45001
                  </b>
                  <span className="block text-[0.72rem] text-landing-gris leading-snug truncate">
                    Usado en 4 faenas · Los Pelambres, Centinela, Andina...
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 03 — Exportación directa al mandante (con rotación pausable de plataformas) */}
        <div className="flex gap-4 items-start">
          <div className="w-[42px] h-[42px] rounded-xl bg-landing-azul-claro text-landing-azul font-extrabold text-base flex items-center justify-center shrink-0">
            03
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <h3 className="font-extrabold text-[1rem] text-landing-ink">
                Exportación directa al mandante
              </h3>
              {/* Control de pausa accesible */}
              <button
                type="button"
                onClick={() => setIsManualPaused((prev) => !prev)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                aria-label={isManualPaused ? "Reanudar rotación de plataformas" : "Pausar rotación de plataformas"}
                title={isManualPaused ? "Reanudar rotación" : "Pausar rotación"}
                className="text-[0.68rem] text-landing-gris hover:text-landing-ink border border-landing-linea rounded-full px-2 py-0.5 bg-white transition-colors"
              >
                <span aria-hidden="true">{isManualPaused ? "▶" : "⏸"}</span>
              </button>
            </div>
            <p className="text-landing-gris text-[0.86rem] leading-relaxed">
              Desde ACREDITTIA envías cada documento a la plataforma que use esa faena.
            </p>
            <div
              className="bg-landing-soft border border-landing-linea rounded-xl p-3.5 mt-3.5"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <div className="flex items-center justify-center gap-3">
                <span className="bg-white border border-landing-linea rounded-full px-3.5 py-1.5 text-[0.74rem] font-bold text-landing-ink shadow-sm">
                  ACREDITTIA
                </span>
                <div className="relative w-10 flex items-center justify-center">
                  <span className="text-landing-gris2 font-extrabold text-sm">→</span>
                  <span className="absolute top-1/2 left-0 w-1.5 h-1.5 rounded-full bg-landing-azul -translate-y-1/2 animate-fe-dot-move" />
                </div>
                <span
                  className={`bg-landing-azul border border-landing-azul rounded-full px-3.5 py-1.5 text-[0.74rem] font-bold text-white shadow-sm transition-opacity duration-300 min-w-[100px] text-center ${
                    isFading ? "opacity-0" : "opacity-100"
                  }`}
                >
                  {PLATFORMS[platIndex]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 04 — Multi-faena, multi-plataforma (chips sin affordance falso, H-14) */}
        <div className="flex gap-4 items-start">
          <div className="w-[42px] h-[42px] rounded-xl bg-landing-azul-claro text-landing-azul font-extrabold text-base flex items-center justify-center shrink-0">
            04
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-[1rem] text-landing-ink mb-1.5">
              Multi-faena, multi-plataforma
            </h3>
            <p className="text-landing-gris text-[0.86rem] leading-relaxed">
              SIGA, Workmate, Webcontrol, Metacontratas o SUCAL. Tú trabajas siempre desde el mismo lugar.
            </p>
            <div className="bg-landing-soft border border-landing-linea rounded-xl p-3.5 mt-3.5">
              <div className="flex flex-wrap gap-2" role="list" aria-label="Plataformas compatibles">
                {PLATFORMS.map((plat) => (
                  <span
                    key={plat}
                    role="listitem"
                    className="bg-white border border-landing-linea rounded-full px-3 py-1.5 text-[0.72rem] font-bold text-landing-gris select-none cursor-default"
                  >
                    {plat}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 05 — Agentes IA por WhatsApp */}
        <div className="flex gap-4 items-start">
          <div className="w-[42px] h-[42px] rounded-xl bg-landing-azul-claro text-landing-azul font-extrabold text-base flex items-center justify-center shrink-0">
            05
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-[1rem] text-landing-ink mb-1.5">
              Agentes IA por WhatsApp
            </h3>
            <p className="text-landing-gris text-[0.86rem] leading-relaxed">
              Piden documentos al trabajador y los cargan de inmediato, sin llamadas.
            </p>
            <div className="bg-landing-soft border border-landing-linea rounded-xl p-3.5 mt-3.5">
              <div className="flex flex-col gap-2">
                <div className="bg-white border border-landing-linea text-landing-ink rounded-[12px_12px_12px_3px] p-2.5 text-[0.74rem] leading-snug max-w-[90%] shadow-sm">
                  Tu examen preocupacional vence en 7 días. ¿Puedes subir el nuevo?
                </div>
                <div className="bg-landing-azul text-white rounded-[12px_12px_3px_12px] p-2.5 text-[0.74rem] leading-snug max-w-[70%] ml-auto shadow-sm">
                  Listo 📎
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 06 — Seguimiento en tiempo real */}
        <div className="flex gap-4 items-start">
          <div className="w-[42px] h-[42px] rounded-xl bg-landing-azul-claro text-landing-azul font-extrabold text-base flex items-center justify-center shrink-0">
            06
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-[1rem] text-landing-ink mb-1.5">
              Seguimiento en tiempo real
            </h3>
            <p className="text-landing-gris text-[0.86rem] leading-relaxed">
              Vencimientos, contratos y avance de cada proveedor, siempre a la vista.
            </p>
            <div className="bg-landing-soft border border-landing-linea rounded-xl p-3.5 mt-3.5">
              <div className="flex flex-col gap-3">
                {/* Fila 1 */}
                <div>
                  <div className="flex justify-between text-[0.76rem] font-bold text-landing-ink mb-1">
                    <span>MLP Operaciones</span>
                    <span className="text-landing-azul">74%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                    <div
                      className="h-full rounded-full bg-landing-azul transition-all duration-1000 ease-out"
                      style={{ width: "74%" }}
                    />
                  </div>
                </div>

                {/* Fila 2 */}
                <div>
                  <div className="flex justify-between text-[0.76rem] font-bold text-landing-ink mb-1">
                    <span>Centinela Servicios</span>
                    <span className="text-landing-verde">91%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                    <div
                      className="h-full rounded-full bg-landing-verde transition-all duration-1000 ease-out"
                      style={{ width: "91%" }}
                    />
                  </div>
                </div>

                {/* Fila 3 */}
                <div>
                  <div className="flex justify-between text-[0.76rem] font-bold text-landing-ink mb-1">
                    <span>Candelaria Infraestr.</span>
                    <span className="text-landing-rojo">42%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                    <div
                      className="h-full rounded-full bg-landing-rojo transition-all duration-1000 ease-out"
                      style={{ width: "42%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import useReveal from "./useReveal";

interface CarpetaRequirement {
  name: string;
  badge: string;
  variant: "activo" | "porvencer" | "vencido";
}

interface CarpetaGroup {
  group: string;
  items: CarpetaRequirement[];
}

const CARPETA_DATA: CarpetaGroup[] = [
  {
    group: "EMPRESA",
    items: [
      { name: "Certificado de tasa de accidentabilidad", badge: "Aprobado", variant: "activo" },
      { name: "Reglamento interno de orden, higiene y seguridad", badge: "Aprobado", variant: "activo" },
      { name: "Póliza de responsabilidad civil", badge: "En revisión", variant: "porvencer" },
    ],
  },
  {
    group: "PERSONAL",
    items: [
      { name: "Licencias profesionales de conductores", badge: "12 de 12", variant: "activo" },
      { name: "Exámenes preocupacionales", badge: "9 de 12", variant: "porvencer" },
    ],
  },
  {
    group: "EQUIPOS",
    items: [
      { name: "Revisión técnica y permiso de circulación", badge: "8 de 8", variant: "activo" },
      { name: "Certificado de mantención", badge: "Falta subir", variant: "vencido" },
    ],
  },
];

const STEPS = [
  {
    n: "1",
    title: "Recibes la carpeta",
    desc: "El mandante te envía la carpeta de arranque del nuevo contrato o servicio.",
  },
  {
    n: "2",
    title: "La subes a ACREDITTIA",
    desc: "Cargas el archivo tal como te llegó, sin transcribir nada a mano.",
  },
  {
    n: "3",
    title: "Queda como requisito",
    desc: "La IA la lee y deja armados los requisitos de la carpeta de arranque para empresa, personal y equipos.",
  },
  {
    n: "4",
    title: "Completas y das seguimiento",
    desc: "Cargas los documentos, ves el avance y recibes alertas de lo que falta.",
  },
];

/**
 * LandingCarpetas — Carpetas de arranque: 4 pasos + tarjeta con barra de avance al 68% animada.
 * Resuelve H-19 (microinteracciones reales en vez de estáticas) y H-48 (comunicación clara del proceso).
 * Referencia HTML: líneas 1315-1351.
 */
export default function LandingCarpetas() {
  const sectionRef = useReveal<HTMLElement>();
  const [hasAnimated, setHasAnimated] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReducedMotion(mediaQuery.matches);
      if (mediaQuery.matches) {
        setHasAnimated(true);
      }
    }
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [sectionRef, prefersReducedMotion]);

  return (
    <section
      ref={sectionRef}
      id="carpetas-arranque"
      className="py-24 px-[6%] bg-white border-t border-landing-linea scroll-mt-20"
      aria-label="Carpetas de arranque en ACREDITTIA"
    >
      <div className="max-w-[1080px] mx-auto">
        {/* Encabezado */}
        <div className="max-w-[700px] mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            CARPETAS DE ARRANQUE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-landing-ink tracking-tight mb-4">
            ¿Te llegó una carpeta de arranque? Súbela y queda lista como requisito
          </h2>
          <p className="text-landing-gris text-base sm:text-lg leading-relaxed">
            Subes la carpeta de arranque que te entrega el mandante y ACREDITTIA la convierte en los requisitos del contrato. Ves todas tus carpetas de arranque, y su avance, en un solo lugar.
          </p>
        </div>

        {/* Grilla: 4 pasos + Tarjeta interactiva 68% */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
          {/* 4 Pasos */}
          <div className="flex flex-col gap-3.5">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="grid grid-cols-[40px_1fr] gap-3.5 items-start bg-white border border-landing-linea rounded-2xl p-4 sm:p-4.5 shadow-2xs hover:border-landing-azul/40 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-landing-azul text-white font-extrabold flex items-center justify-center text-sm shadow-xs">
                  {step.n}
                </div>
                <div>
                  <b className="block text-sm sm:text-base font-bold text-landing-ink mb-1">
                    {step.title}
                  </b>
                  <span className="text-xs sm:text-sm text-landing-gris leading-relaxed">
                    {step.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Tarjeta con avance animado al 68% */}
          <div className="bg-white border border-landing-linea rounded-[18px] p-5 sm:p-6 shadow-[0_30px_70px_-30px_rgba(13,27,42,0.28)]">
            <div className="flex justify-between items-start gap-3.5 pb-2">
              <div>
                <b className="block text-sm sm:text-base font-bold text-landing-ink">
                  Carpeta de arranque · Contrato de transporte de personal
                </b>
                <small className="block text-xs text-landing-gris mt-0.5">
                  Requisitos cargados desde la carpeta del mandante
                </small>
                <span className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-bold text-landing-azul bg-[#EEF4FF] rounded-full px-3 py-1">
                  📁 carpeta_arranque.pdf
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-landing-azul leading-none">
                68%
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="h-2 rounded-full bg-landing-linea overflow-hidden my-4">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-landing-azul carq-bar-fill"
                style={{ width: hasAnimated ? "68%" : "0%" }}
                role="progressbar"
                aria-valuenow={68}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Avance de la carpeta de arranque: 68%"
              />
            </div>

            {/* Grupos de requisitos */}
            <div className="space-y-3">
              {CARPETA_DATA.map((group) => (
                <div key={group.group}>
                  <div className="text-[0.66rem] font-extrabold tracking-widest text-landing-gris uppercase mb-1.5 pt-1">
                    {group.group}
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center gap-2 text-xs text-landing-ink py-1.5 border-b border-dashed border-landing-linea last:border-b-0"
                      >
                        <span className="truncate pr-2">{item.name}</span>
                        <span
                          className={`font-bold px-2.5 py-0.5 rounded-full text-[0.68rem] shrink-0 ${
                            item.variant === "activo"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.variant === "porvencer"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notas al pie de la sección */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-8">
          <div className="bg-landing-soft rounded-2xl p-4 sm:p-4.5 text-xs sm:text-sm text-landing-gris leading-relaxed">
            <strong className="text-landing-ink font-bold block mb-0.5">
              Sin transcribir requisitos a mano:
            </strong>
            La carpeta del mandante se convierte directamente en tu checklist estructurado.
          </div>
          <div className="bg-landing-soft rounded-2xl p-4 sm:p-4.5 text-xs sm:text-sm text-landing-gris leading-relaxed">
            <strong className="text-landing-ink font-bold block mb-0.5">
              Reutilizable:
            </strong>
            En el próximo arranque con el mismo mandante, los requisitos ya quedan cargados.
          </div>
        </div>
      </div>
    </section>
  );
}

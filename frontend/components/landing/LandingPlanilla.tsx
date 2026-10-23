"use client";

import React, { useState, useEffect } from "react";
import useReveal from "./useReveal";

interface RequirementItem {
  name: string;
  status: string;
  variant: "activo" | "porvencer" | "vencido";
}

const REQUISITOS_PEDRO: RequirementItem[] = [
  { name: "Cédula de identidad", status: "Vigente", variant: "activo" },
  { name: "Contrato de trabajo", status: "Vigente", variant: "activo" },
  { name: "Foto carnet", status: "Vigente", variant: "activo" },
  { name: "Psicosensotécnico ACHS", status: "Vence 24-02-2027", variant: "porvencer" },
  { name: "Hoja de vida", status: "Vigente", variant: "activo" },
];

/**
 * LandingPlanilla — De la planilla al orden: comparativa Excel vs checklist con mock de correo animado.
 * Resuelve H-37 (sin cifras huérfanas), H-21 (interacción React sin video/GIF) y H-46 (contexto completo).
 * Referencia HTML: líneas 1493-1550 y 1989-1998.
 */
export default function LandingPlanilla() {
  const sectionRef = useReveal<HTMLElement>();

  // Estado del correo animado (ciclo automático y control manual)
  const [isMailOpen, setIsMailOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isManualPaused, setIsManualPaused] = useState(false);
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

  useEffect(() => {
    if (prefersReducedMotion || isManualPaused || isHovered) {
      // Con movimiento reducido o pausa manual, dejamos el correo abierto y legible
      setIsMailOpen(true);
      return;
    }

    // Ciclo automático del HTML original: abre y cierra cada 5.2s
    let timeoutId: NodeJS.Timeout;
    const interval = setInterval(() => {
      setIsMailOpen(false);
      timeoutId = setTimeout(() => {
        setIsMailOpen(true);
      }, 1400);
    }, 5200);

    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [prefersReducedMotion, isManualPaused, isHovered]);

  return (
    <section
      ref={sectionRef}
      id="orden"
      className="py-24 px-[6%] bg-white border-t border-landing-linea scroll-mt-20"
      aria-label="De la planilla al orden en ACREDITTIA"
    >
      <div className="max-w-[1180px] mx-auto">
        {/* Encabezado */}
        <div className="max-w-[760px] mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-landing-azul-claro text-landing-azul font-bold text-[0.74rem] tracking-wider uppercase mb-4">
            <span className="w-2 h-2 rounded-full bg-landing-azul" />
            DE LA PLANILLA AL ORDEN
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-landing-ink tracking-tight mb-4">
            Lo que hoy es una planilla gigante, en ACREDITTIA es una vista clara
          </h2>
          <p className="text-landing-gris text-base sm:text-lg leading-relaxed">
            Nombres y decenas de requisitos desparramados en columnas. ACREDITTIA lo convierte en un checklist por persona, con vigencias controladas y aviso automático al correo antes de cada vencimiento.
          </p>
        </div>

        {/* Comparativa: Excel vs Acredittia */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_48px_1fr] gap-6 lg:gap-4 items-start max-w-[1120px] mx-auto">
          {/* Columna Izquierda: Hoy en Excel */}
          <div className="flex flex-col gap-4">
            <span className="self-start font-mono text-[0.66rem] font-extrabold tracking-wider uppercase bg-[#F1F5F9] text-landing-gris px-3.5 py-1.5 rounded-full">
              Hoy: planilla Excel
            </span>

            <div className="border border-landing-linea rounded-2xl overflow-x-auto bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-[0.65rem] whitespace-nowrap">
                <thead>
                  <tr className="bg-[#E9EDF2] text-[#475569] font-bold border-b border-[#D8DEE6]">
                    <th className="p-2 border-r border-[#D8DEE6]">N°</th>
                    <th className="p-2 border-r border-[#D8DEE6]">NOMBRE</th>
                    <th className="p-2 border-r border-[#D8DEE6]">CARGO</th>
                    <th className="p-2 border-r border-[#D8DEE6]">CÉDULA</th>
                    <th className="p-2 border-r border-[#D8DEE6]">CONTRATO</th>
                    <th className="p-2 border-r border-[#D8DEE6]">FOTO</th>
                    <th className="p-2 border-r border-[#D8DEE6]">PSICOSENSOMÉTRICO</th>
                    <th className="p-2 border-r border-[#D8DEE6]">FECHA PSICO</th>
                    <th className="p-2">HOJA DE VIDA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EAEF] text-[#334155]">
                  <tr>
                    <td className="p-2 border-r border-[#E7EAEF]">1</td>
                    <td className="p-2 border-r border-[#E7EAEF] font-semibold">Pérez González Juan</td>
                    <td className="p-2 border-r border-[#E7EAEF]">CONDUCTOR</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF]"></td>
                    <td className="p-2 border-r border-[#E7EAEF]"></td>
                    <td className="p-2 border-r border-[#E7EAEF]"></td>
                    <td className="p-2"></td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-[#E7EAEF]">2</td>
                    <td className="p-2 border-r border-[#E7EAEF] font-semibold">Soto Martínez Ana</td>
                    <td className="p-2 border-r border-[#E7EAEF]">CONDUCTOR</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">25-02-2027%</td>
                    <td className="p-2 bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="p-2 border-r border-[#E7EAEF]">6</td>
                    <td className="p-2 border-r border-[#E7EAEF] font-bold text-landing-ink">Muñoz Rojas Pedro</td>
                    <td className="p-2 border-r border-[#E7EAEF]">CONDUCTOR</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#FEF3C7] text-[#874D2D] font-bold text-center animate-xls-warn">
                      24/02/2027
                    </td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#FEE2E2] text-[#A43232] font-bold text-center animate-xls-bad">
                      0%
                    </td>
                    <td className="p-2 bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                  </tr>
                  <tr>
                    <td className="p-2 border-r border-[#E7EAEF]">15</td>
                    <td className="p-2 border-r border-[#E7EAEF] font-semibold">Vidal Cárcamo Luis</td>
                    <td className="p-2 border-r border-[#E7EAEF]">CONDUCTOR</td>
                    <td className="p-2 border-r border-[#E7EAEF]"></td>
                    <td className="p-2 border-r border-[#E7EAEF]"></td>
                    <td className="p-2 border-r border-[#E7EAEF]"></td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">100%</td>
                    <td className="p-2 border-r border-[#E7EAEF] bg-[#DCFCE7] text-[#15803D] font-bold text-center">08-07-2026%</td>
                    <td className="p-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-xs text-landing-gris leading-relaxed">
              <strong className="text-landing-ink">Decenas de columnas, celdas vacías y fechas metidas en la columna equivocada.</strong> Nadie sabe qué falta de verdad sin revisar fila por fila.
            </p>
          </div>

          {/* Flecha Central */}
          <div className="hidden lg:flex items-center justify-center pt-24 text-landing-azul text-2xl font-black">
            <span className="animate-xls-arrow">→</span>
          </div>

          {/* Columna Derecha: En ACREDITTIA */}
          <div className="flex flex-col gap-4">
            <span className="self-start font-mono text-[0.66rem] font-extrabold tracking-wider uppercase bg-landing-azul-claro text-landing-azul-d px-3.5 py-1.5 rounded-full">
              En ACREDITTIA
            </span>

            {/* Checklist de la persona */}
            <div className="border border-landing-linea rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3 pb-3.5 mb-3.5 border-b border-landing-linea">
                <div className="w-10 h-10 rounded-full bg-landing-azul-claro text-landing-azul-d font-black text-sm flex items-center justify-center shrink-0">
                  PR
                </div>
                <div>
                  <b className="block text-sm text-landing-ink font-bold">
                    Pedro Muñoz Rojas
                  </b>
                  <span className="block text-xs text-landing-gris">
                    Conductor · Minera Los Pelambres (MLP)
                  </span>
                </div>
              </div>

              <div className="space-y-2.5">
                {REQUISITOS_PEDRO.map((req, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs text-landing-ink py-1 border-b border-dashed border-landing-linea/60 last:border-b-0"
                  >
                    <span>{req.name}</span>
                    <span
                      className={`font-bold px-2.5 py-1 rounded-full text-[0.7rem] ${
                        req.variant === "activo"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : req.variant === "porvencer"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mockup de Correo con ciclo abrir/cerrar */}
            <div
              className="border border-landing-linea rounded-2xl bg-white shadow-sm overflow-hidden transition-all duration-300"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Barra superior de la ventana */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F7F9FC] border-b border-landing-linea">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                  <span className="ml-2 text-[0.68rem] font-bold text-landing-gris">
                    Bandeja de entrada
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsManualPaused((prev) => !prev);
                    setIsMailOpen((prev) => !prev);
                  }}
                  className="text-[0.65rem] font-semibold text-landing-azul hover:underline focus:outline-none focus:ring-1 focus:ring-landing-azul rounded px-1"
                  aria-label={isMailOpen ? "Colapsar vista previa del correo" : "Expandir vista previa del correo"}
                >
                  {isMailOpen ? "Cerrar" : "Abrir"}
                </button>
              </div>

              {/* Fila del correo */}
              <div
                onClick={() => setIsMailOpen((prev) => !prev)}
                className="flex items-center gap-2.5 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsMailOpen((prev) => !prev);
                  }
                }}
                aria-expanded={isMailOpen}
              >
                <span
                  className={`w-2 h-2 rounded-full bg-landing-azul shrink-0 transition-opacity duration-300 ${
                    isMailOpen ? "opacity-0 scale-0" : "opacity-100 scale-100"
                  }`}
                />
                <span className="text-base shrink-0">📧</span>
                <div className="flex-1 min-w-0">
                  <b className="block text-xs font-bold text-landing-ink">
                    ACREDITTIA
                  </b>
                  <span
                    className={`block text-[0.72rem] text-landing-gris truncate ${
                      isMailOpen ? "font-normal" : "font-bold text-landing-ink"
                    }`}
                  >
                    Psicosensotécnico ACHS de Pedro vence en 5 días...
                  </span>
                </div>
                <span className="text-[0.66rem] text-landing-gris2 shrink-0">
                  Ahora
                </span>
              </div>

              {/* Cuerpo desplegable del correo */}
              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out border-t ${
                  isMailOpen
                    ? "max-h-[260px] opacity-100 p-4 border-landing-linea bg-white"
                    : "max-h-0 opacity-0 p-0 border-transparent bg-white"
                }`}
              >
                <div className="mb-2.5">
                  <b className="block text-xs font-bold text-landing-ink">
                    Psicosensotécnico ACHS por vencer
                  </b>
                  <span className="block text-[0.68rem] text-landing-gris2 mt-0.5">
                    De: alertas@acredittia.cl · Para: ti
                  </span>
                </div>
                <p className="text-xs text-landing-ink leading-relaxed mb-3">
                  Hola, te avisamos que el examen <strong>Psicosensotécnico ACHS</strong> de <strong>Pedro Muñoz Rojas</strong> vence el <strong>24-02-2027</strong>. Sube el documento renovado en ACREDITTIA antes de esa fecha para que el contrato siga vigente.
                </p>
                <span className="text-[0.7rem] font-bold text-emerald-600 flex items-center gap-1">
                  ✓✓ Leído automáticamente
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

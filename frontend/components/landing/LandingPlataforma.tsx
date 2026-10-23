"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { LANDING_SECTIONS } from "./sections";

type ViewKey = "home" | "contratos" | "mandantes" | "personal" | "equipos" | "requisitos" | "alertas";

interface SidebarItem {
  key: ViewKey;
  label: string;
  icon: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "home", label: "Inicio", icon: "🏠" },
  { key: "contratos", label: "Contratos", icon: "📋" },
  { key: "mandantes", label: "Mandantes", icon: "🏢" },
  { key: "personal", label: "Personal", icon: "👥" },
  { key: "equipos", label: "Equipos / Vehículos", icon: "🚛" },
  { key: "requisitos", label: "Requisitos", icon: "📑" },
  { key: "alertas", label: "Alertas", icon: "🔔" },
];

/**
 * LandingPlataforma — Mockup navegable de la plataforma Acredittia (Día 2).
 * - Marco de aplicación con barra chrome y URL técnica en mono.
 * - Sidebar lateral con 7 vistas completas navegables por click.
 * - Autoplay a 3.200 ms con control de pausa accesible y visible (H-26, H-32, H-27).
 * - Cero perspectiva 3D, diseño 100% plano y responsive.
 */
export default function LandingPlataforma() {
  const [activeView, setActiveView] = useState<ViewKey>("home");
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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

  const nextView = useCallback(() => {
    setActiveView((prev) => {
      const idx = SIDEBAR_ITEMS.findIndex((item) => item.key === prev);
      const nextIdx = (idx + 1) % SIDEBAR_ITEMS.length;
      return SIDEBAR_ITEMS[nextIdx].key;
    });
  }, []);

  useEffect(() => {
    if (!shouldAutoplay) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const timeout = setTimeout(() => {
      timerRef.current = setInterval(nextView, 3200);
    }, 1200);

    return () => {
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [shouldAutoplay, nextView]);

  return (
    <section
      id={LANDING_SECTIONS.PLATAFORMA}
      className="py-20 lg:py-28 px-[6%] bg-white scroll-mt-20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Encabezado de la sección */}
      <div className="max-w-[720px] mx-auto text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-2 text-landing-azul font-bold text-[0.82rem] tracking-wider uppercase mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-landing-azul" />
          <span>LA PLATAFORMA</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-[-0.01em] text-landing-ink mb-4 font-landing-sans">
          Así se ve por dentro
        </h2>
        <p className="text-landing-gris text-base sm:text-[1.05rem] leading-[1.6]">
          Un panel: todos tus contratos, documentos y alertas, en tiempo real.
        </p>
      </div>

      {/* Frame de la plataforma navegable */}
      <div className="max-w-[1180px] mx-auto rounded-[20px] overflow-hidden border border-landing-linea shadow-landing-frame bg-white">
        {/* Barra superior estilo navegador */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-landing-linea bg-landing-soft2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
            <div className="ml-3 px-3 py-1 rounded-md bg-white border border-landing-linea text-[0.74rem] text-landing-gris font-mono">
              app.acredittia.cl/dashboard
            </div>
          </div>

          {/* Control de pausa visible y accesible */}
          <button
            type="button"
            onClick={() => setIsManualPaused((prev) => !prev)}
            aria-label={isManualPaused ? "Reanudar rotación de la plataforma" : "Pausar rotación de la plataforma"}
            title={isManualPaused ? "Reanudar rotación automática" : "Pausar rotación automática"}
            className="flex items-center gap-1.5 text-[0.72rem] font-bold px-2.5 py-1 rounded-md border border-landing-linea bg-white text-landing-gris hover:text-landing-ink hover:border-landing-gris2 transition-colors"
          >
            <span aria-hidden="true" className="text-[0.68rem]">{isManualPaused ? "▶" : "⏸"}</span>
            <span className="hidden sm:inline">{isManualPaused ? "Reanudar" : "Pausar"}</span>
          </button>
        </div>

        {/* Cuerpo: Sidebar + Vista principal */}
        <div className="grid grid-cols-1 md:grid-cols-[68px_1fr] min-h-[460px]">
          {/* Sidebar de 7 vistas navegables */}
          <div
            role="tablist"
            aria-label="Vistas de la plataforma"
            className="flex md:flex-col items-center justify-start gap-1 p-2 bg-[#0F172A] border-r border-landing-linea overflow-x-auto scrollbar-none"
          >
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = activeView === item.key;
              return (
                <button
                  key={item.key}
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => setActiveView(item.key)}
                  title={item.label}
                  aria-label={item.label}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-landing-azul text-white shadow-md scale-105"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {item.icon}
                </button>
              );
            })}
          </div>

          {/* Contenedor de la vista activa */}
          <div className="p-4 sm:p-6 lg:p-7 bg-[#F8FAFC] overflow-x-auto">
            {/* VISTA 1: HOME / INICIO */}
            {activeView === "home" && (
              <div className="animate-plat-fade">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <h4 className="text-lg font-extrabold text-landing-ink m-0">Inicio</h4>
                    <span className="text-xs text-landing-gris">Resumen de tu operación en todas las faenas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-white border border-landing-linea flex items-center justify-center text-xs">
                      🔔
                    </span>
                    <div className="flex items-center gap-2 bg-white border border-landing-linea rounded-xl px-3 py-1.5 shadow-sm">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-landing-azul to-blue-400 text-white text-[0.62rem] font-bold flex items-center justify-center">
                        P
                      </div>
                      <span className="text-xs font-bold text-landing-ink">Proveedor SpA</span>
                    </div>
                  </div>
                </div>

                {/* 5 KPIs */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                  <div className="bg-white p-3.5 rounded-xl border border-landing-linea shadow-sm">
                    <div className="text-base mb-1">📋</div>
                    <div className="text-[0.68rem] font-semibold text-landing-gris">Contratos activos</div>
                    <b className="text-xl font-extrabold text-landing-ink block">12</b>
                    <span className="text-[0.65rem] text-landing-gris2 font-bold">de 12 totales</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-landing-linea shadow-sm">
                    <div className="text-base mb-1">🏔️</div>
                    <div className="text-[0.68rem] font-semibold text-landing-gris">Faenas activas</div>
                    <b className="text-xl font-extrabold text-landing-ink block">9</b>
                    <span className="text-[0.65rem] text-landing-gris2 font-bold">de 9 totales</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-landing-linea shadow-sm">
                    <div className="text-base mb-1">👥</div>
                    <div className="text-[0.68rem] font-semibold text-landing-gris">Personal acreditado</div>
                    <b className="text-xl font-extrabold text-landing-ink block">21</b>
                    <span className="text-[0.65rem] text-landing-verde font-bold">de 24 trabajadores</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-landing-linea shadow-sm">
                    <div className="text-base mb-1">🚛</div>
                    <div className="text-[0.68rem] font-semibold text-landing-gris">Equipos acreditados</div>
                    <b className="text-xl font-extrabold text-landing-ink block">7</b>
                    <span className="text-[0.65rem] text-landing-verde font-bold">de 8 equipos</span>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-landing-linea shadow-sm col-span-2 sm:col-span-1">
                    <div className="text-base mb-1">📈</div>
                    <div className="text-[0.68rem] font-semibold text-landing-gris">Cumplimiento</div>
                    <b className="text-xl font-extrabold text-landing-azul block">86%</b>
                    <span className="text-[0.65rem] text-landing-verde font-bold">+6% vs. sem. pasada</span>
                  </div>
                </div>

                {/* Tabla de contratos destacados */}
                <div className="bg-white rounded-xl border border-landing-linea overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-landing-linea bg-landing-soft text-landing-gris font-bold">
                          <th className="p-3">Contrato</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Cumplimiento</th>
                          <th className="p-3">Personal</th>
                          <th className="p-3">Equipos</th>
                          <th className="p-3">Alertas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-landing-linea font-medium text-landing-ink">
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">MLP Operaciones</span>
                            <div className="text-[0.66rem] text-landing-gris">Los Pelambres · SIGA</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Activo</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "74%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">74%</span>
                            </div>
                          </td>
                          <td className="p-3">9/9</td>
                          <td className="p-3">3/3</td>
                          <td className="p-3"><span className="px-1.5 py-0.5 rounded-md text-[0.68rem] font-bold bg-amber-100 text-landing-ambar">2</span></td>
                        </tr>
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">Centinela Servicios</span>
                            <div className="text-[0.66rem] text-landing-gris">Centinela · WEBCONTROL</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Activo</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "91%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">91%</span>
                            </div>
                          </td>
                          <td className="p-3">6/6</td>
                          <td className="p-3">2/2</td>
                          <td className="p-3 text-landing-gris2 font-bold">0</td>
                        </tr>
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">Candelaria Infraestr.</span>
                            <div className="text-[0.66rem] text-landing-gris">Candelaria · WEBCONTROL</div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-red-100 text-landing-rojo">Vencido</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "42%" }} className="h-full bg-landing-rojo rounded-full" />
                              </div>
                              <span className="font-bold">42%</span>
                            </div>
                          </td>
                          <td className="p-3">4/6</td>
                          <td className="p-3">1/2</td>
                          <td className="p-3"><span className="px-1.5 py-0.5 rounded-md text-[0.68rem] font-bold bg-red-100 text-landing-rojo">3</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 2: CONTRATOS */}
            {activeView === "contratos" && (
              <div className="animate-plat-fade">
                <h4 className="text-lg font-extrabold text-landing-ink m-0">Contratos</h4>
                <p className="text-xs text-landing-gris mb-4">Uno por faena: cada uno con su propia plataforma y requisitos.</p>
                <div className="bg-white rounded-xl border border-landing-linea overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-landing-linea bg-landing-soft text-landing-gris font-bold">
                          <th className="p-3">Contrato</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Cumplimiento</th>
                          <th className="p-3">Personal</th>
                          <th className="p-3">Equipos</th>
                          <th className="p-3">Alertas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-landing-linea font-medium text-landing-ink">
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">MLP Operaciones</span>
                            <div className="text-[0.66rem] text-landing-gris">Los Pelambres · SIGA</div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Activo</span></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "74%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">74%</span>
                            </div>
                          </td>
                          <td className="p-3">9/9</td>
                          <td className="p-3">3/3</td>
                          <td className="p-3"><span className="px-1.5 py-0.5 rounded-md text-[0.68rem] font-bold bg-amber-100 text-landing-ambar">2</span></td>
                        </tr>
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">Centinela Servicios</span>
                            <div className="text-[0.66rem] text-landing-gris">Centinela · WEBCONTROL</div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Activo</span></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "91%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">91%</span>
                            </div>
                          </td>
                          <td className="p-3">6/6</td>
                          <td className="p-3">2/2</td>
                          <td className="p-3 text-landing-gris2 font-bold">0</td>
                        </tr>
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">Candelaria Infraestr.</span>
                            <div className="text-[0.66rem] text-landing-gris">Candelaria · WEBCONTROL</div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-red-100 text-landing-rojo">Vencido</span></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "42%" }} className="h-full bg-landing-rojo rounded-full" />
                              </div>
                              <span className="font-bold">42%</span>
                            </div>
                          </td>
                          <td className="p-3">4/6</td>
                          <td className="p-3">1/2</td>
                          <td className="p-3"><span className="px-1.5 py-0.5 rounded-md text-[0.68rem] font-bold bg-red-100 text-landing-rojo">3</span></td>
                        </tr>
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">Andina Norte</span>
                            <div className="text-[0.66rem] text-landing-gris">Andina · SUCAL</div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Activo</span></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "88%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">88%</span>
                            </div>
                          </td>
                          <td className="p-3">5/5</td>
                          <td className="p-3">2/2</td>
                          <td className="p-3 text-landing-gris2 font-bold">0</td>
                        </tr>
                        <tr>
                          <td className="p-3">
                            <span className="font-bold text-landing-azul hover:underline cursor-pointer">P. Eólico Antofagasta I</span>
                            <div className="text-[0.66rem] text-landing-gris">Antofagasta I · METACONTRATAS</div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-amber-100 text-landing-ambar">Por vencer</span></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "63%" }} className="h-full bg-landing-ambar rounded-full" />
                              </div>
                              <span className="font-bold">63%</span>
                            </div>
                          </td>
                          <td className="p-3">3/4</td>
                          <td className="p-3">1/1</td>
                          <td className="p-3"><span className="px-1.5 py-0.5 rounded-md text-[0.68rem] font-bold bg-amber-100 text-landing-ambar">1</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 3: MANDANTES */}
            {activeView === "mandantes" && (
              <div className="animate-plat-fade">
                <h4 className="text-lg font-extrabold text-landing-ink m-0">Mandantes</h4>
                <p className="text-xs text-landing-gris mb-4">Cada mandante, con su plataforma y requisitos ya mapeados.</p>
                <div className="bg-white rounded-xl border border-landing-linea p-3 sm:p-4 divide-y divide-landing-linea shadow-sm">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-landing-soft flex items-center justify-center text-base">⛏️</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Antofagasta Minerals</b>
                        <small className="text-[0.68rem] text-landing-gris">Los Pelambres · Centinela · Antucoya · Zaldívar · SIGA / WORKMATE</small>
                      </div>
                    </div>
                    <span className="text-[0.72rem] font-bold text-landing-azul bg-landing-azul-claro px-2.5 py-1 rounded-full whitespace-nowrap">4 faenas</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-landing-soft flex items-center justify-center text-base">⛏️</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Lundin Mining</b>
                        <small className="text-[0.68rem] text-landing-gris">Candelaria · Caserones · WEBCONTROL</small>
                      </div>
                    </div>
                    <span className="text-[0.72rem] font-bold text-landing-azul bg-landing-azul-claro px-2.5 py-1 rounded-full whitespace-nowrap">2 faenas</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-landing-soft flex items-center justify-center text-base">⛏️</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Codelco</b>
                        <small className="text-[0.68rem] text-landing-gris">El Teniente · Andina · SUCAL</small>
                      </div>
                    </div>
                    <span className="text-[0.72rem] font-bold text-landing-azul bg-landing-azul-claro px-2.5 py-1 rounded-full whitespace-nowrap">2 faenas</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-landing-soft flex items-center justify-center text-base">🌬️</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Repsol</b>
                        <small className="text-[0.68rem] text-landing-gris">Parque Eólico Antofagasta I · METACONTRATAS</small>
                      </div>
                    </div>
                    <span className="text-[0.72rem] font-bold text-landing-azul bg-landing-azul-claro px-2.5 py-1 rounded-full whitespace-nowrap">1 faena</span>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 4: PERSONAL */}
            {activeView === "personal" && (
              <div className="animate-plat-fade">
                <h4 className="text-lg font-extrabold text-landing-ink m-0">Personal</h4>
                <p className="text-xs text-landing-gris mb-4">Documentos y vigencias de cada trabajador, en cualquier faena.</p>
                <div className="bg-white rounded-xl border border-landing-linea overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-landing-linea bg-landing-soft text-landing-gris font-bold">
                          <th className="p-3">Trabajador</th>
                          <th className="p-3">Cargo</th>
                          <th className="p-3">Contrato</th>
                          <th className="p-3">Cumplimiento</th>
                          <th className="p-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-landing-linea font-medium text-landing-ink">
                        <tr>
                          <td className="p-3 font-bold">Rodrigo Soto</td>
                          <td className="p-3 text-landing-gris">Operador</td>
                          <td className="p-3">Los Pelambres</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "100%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">100%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Al día</span></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold">Marcela Vidal</td>
                          <td className="p-3 text-landing-gris">Prevencionista</td>
                          <td className="p-3">Centinela</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "100%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">100%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Al día</span></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold">José Toro</td>
                          <td className="p-3 text-landing-gris">Mecánico</td>
                          <td className="p-3">Candelaria</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "80%" }} className="h-full bg-landing-ambar rounded-full" />
                              </div>
                              <span className="font-bold">80%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-amber-100 text-landing-ambar">Por vencer</span></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold">Ana Reyes</td>
                          <td className="p-3 text-landing-gris">Supervisora</td>
                          <td className="p-3">Andina</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "55%" }} className="h-full bg-landing-rojo rounded-full" />
                              </div>
                              <span className="font-bold">55%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-red-100 text-landing-rojo">Vencido</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 5: EQUIPOS */}
            {activeView === "equipos" && (
              <div className="animate-plat-fade">
                <h4 className="text-lg font-extrabold text-landing-ink m-0">Equipos / Vehículos</h4>
                <p className="text-xs text-landing-gris mb-4">Documentación técnica y de mantención, siempre al día.</p>
                <div className="bg-white rounded-xl border border-landing-linea overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-landing-linea bg-landing-soft text-landing-gris font-bold">
                          <th className="p-3">Equipo</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Contrato</th>
                          <th className="p-3">Cumplimiento</th>
                          <th className="p-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-landing-linea font-medium text-landing-ink">
                        <tr>
                          <td className="p-3 font-bold">Camión Tolva 04</td>
                          <td className="p-3 text-landing-gris">Transporte</td>
                          <td className="p-3">Los Pelambres</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "100%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">100%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Al día</span></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold">Grúa Horquilla 02</td>
                          <td className="p-3 text-landing-gris">Carguío</td>
                          <td className="p-3">Centinela</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "100%" }} className="h-full bg-landing-verde rounded-full" />
                              </div>
                              <span className="font-bold">100%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-green-100 text-landing-verde">Al día</span></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold">Generador 150kVA</td>
                          <td className="p-3 text-landing-gris">Energía</td>
                          <td className="p-3">Candelaria</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "70%" }} className="h-full bg-landing-ambar rounded-full" />
                              </div>
                              <span className="font-bold">70%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-amber-100 text-landing-ambar">Por vencer</span></td>
                        </tr>
                        <tr>
                          <td className="p-3 font-bold">Camioneta 4x4</td>
                          <td className="p-3 text-landing-gris">Liviano</td>
                          <td className="p-3">Andina</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-landing-linea overflow-hidden">
                                <div style={{ width: "40%" }} className="h-full bg-landing-rojo rounded-full" />
                              </div>
                              <span className="font-bold">40%</span>
                            </div>
                          </td>
                          <td className="p-3"><span className="px-2 py-0.5 rounded-full text-[0.66rem] font-bold bg-red-100 text-landing-rojo">Vencido</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 6: REQUISITOS */}
            {activeView === "requisitos" && (
              <div className="animate-plat-fade">
                <h4 className="text-lg font-extrabold text-landing-ink m-0">Requisitos</h4>
                <p className="text-xs text-landing-gris mb-4">Los de las 9 faenas integradas ya están cargados. ¿Otra faena? Los defines tú, una sola vez.</p>
                
                {/* 4 mini-stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="bg-white p-3 rounded-xl border border-landing-linea text-center">
                    <b className="text-xl font-extrabold text-landing-rojo block">2</b>
                    <span className="text-[0.68rem] font-bold text-landing-gris">Faltante</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-landing-linea text-center">
                    <b className="text-xl font-extrabold text-landing-ambar block">3</b>
                    <span className="text-[0.68rem] font-bold text-landing-gris">Requiere acción</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-landing-linea text-center">
                    <b className="text-xl font-extrabold text-landing-azul block">1</b>
                    <span className="text-[0.68rem] font-bold text-landing-gris">En proceso</span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-landing-linea text-center">
                    <b className="text-xl font-extrabold text-landing-verde block">12</b>
                    <span className="text-[0.68rem] font-bold text-landing-gris">Aprobado</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-landing-linea p-3 sm:p-4 divide-y divide-landing-linea shadow-sm">
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-landing-soft flex items-center justify-center text-sm">📑</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Los Pelambres · SIGA</b>
                        <small className="text-[0.66rem] text-landing-gris">12 requisitos mapeados</small>
                      </div>
                    </div>
                    <span className="text-[0.68rem] font-bold text-landing-verde bg-green-50 px-2.5 py-0.5 rounded-full">Integrada</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-landing-soft flex items-center justify-center text-sm">📑</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Centinela · WEBCONTROL</b>
                        <small className="text-[0.66rem] text-landing-gris">9 requisitos mapeados</small>
                      </div>
                    </div>
                    <span className="text-[0.68rem] font-bold text-landing-verde bg-green-50 px-2.5 py-0.5 rounded-full">Integrada</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-landing-soft flex items-center justify-center text-sm">📑</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">P. Eólico Antofagasta I · METACONTRATAS</b>
                        <small className="text-[0.66rem] text-landing-gris">Requisitos configurados por ti, incluye F30-1 mensual</small>
                      </div>
                    </div>
                    <span className="text-[0.68rem] font-bold text-landing-ambar bg-amber-50 px-2.5 py-0.5 rounded-full">Personalizada</span>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 7: ALERTAS */}
            {activeView === "alertas" && (
              <div className="animate-plat-fade">
                <h4 className="text-lg font-extrabold text-landing-ink m-0">Alertas</h4>
                <p className="text-xs text-landing-gris mb-4">Antes de que un documento venza, ya tienes el aviso en tu correo.</p>
                <div className="bg-white rounded-xl border border-landing-linea p-3 sm:p-4 divide-y divide-landing-linea shadow-sm">
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-landing-rojo flex items-center justify-center text-sm">⚠️</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Certificado de mantención</b>
                        <small className="text-[0.68rem] text-landing-gris">Generador 150kVA · Candelaria</small>
                      </div>
                    </div>
                    <span className="text-[0.7rem] font-extrabold text-landing-rojo">Vencido</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-landing-ambar flex items-center justify-center text-sm">⏰</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">Licencia de conducir</b>
                        <small className="text-[0.68rem] text-landing-gris">José Toro · Candelaria</small>
                      </div>
                    </div>
                    <span className="text-[0.7rem] font-extrabold text-landing-ambar">5 días</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-landing-ambar flex items-center justify-center text-sm">⏰</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">ISO 45001</b>
                        <small className="text-[0.68rem] text-landing-gris">Proveedor SpA · Empresa</small>
                      </div>
                    </div>
                    <span className="text-[0.7rem] font-extrabold text-landing-ambar">20 días</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-landing-ambar flex items-center justify-center text-sm">⏰</div>
                      <div>
                        <b className="block text-xs font-bold text-landing-ink">F30-1 mensual</b>
                        <small className="text-[0.68rem] text-landing-gris">P. Eólico Antofagasta I · METACONTRATAS</small>
                      </div>
                    </div>
                    <span className="text-[0.7rem] font-extrabold text-landing-ambar">8 días</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

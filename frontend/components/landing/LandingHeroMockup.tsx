"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

interface RowItem {
  who: string;
  what: string;
  pct: number;
  color: string;
  status: string;
  avatar: { type: "img" | "emoji" | "initials"; src?: string; text?: string; bg?: string };
}

interface Dataset {
  name: string;
  label: string;
  hasAlert: boolean;
  rows: RowItem[];
}

const DATASETS: Dataset[] = [
  {
    name: "Panel",
    label: "DOCUMENTOS POR VENCER",
    hasAlert: false,
    rows: [
      { who: "Rodrigo Soto", what: "Licencia · Personal", pct: 85, color: "#BC7627", status: "5 días", avatar: { type: "img", src: "/trab_rodrigo.jpg" } },
      { who: "Tracto FH #07", what: "Rev. técnica · Equipos", pct: 60, color: "#1D4ED8", status: "12 días", avatar: { type: "img", src: "/tipo_tractocamion.jpeg" } },
      { who: "Proveedor SpA", what: "ISO 45001 · Empresa", pct: 35, color: "#16A34A", status: "20 días", avatar: { type: "emoji", text: "🏢" } },
    ],
  },
  {
    name: "Contratos",
    label: "CONTRATOS ACTIVOS",
    hasAlert: false,
    rows: [
      { who: "P. Eólico Antofagasta I", what: "METACONTRATAS", pct: 90, color: "#16A34A", status: "90% · Vigente", avatar: { type: "img", src: "/plat_metacontratas.png" } },
      { who: "El Teniente", what: "SUCAL", pct: 55, color: "#BC7627", status: "55% · Por vencer", avatar: { type: "img", src: "/plat_sucal.png" } },
      { who: "Los Pelambres", what: "SIGA", pct: 80, color: "#1D4ED8", status: "80% · Vigente", avatar: { type: "img", src: "/plat_siga.png" } },
    ],
  },
  {
    name: "Empresa",
    label: "DOCUMENTOS DE EMPRESA",
    hasAlert: false,
    rows: [
      { who: "Proveedor SpA", what: "ISO 45001", pct: 90, color: "#16A34A", status: "12-06-2027 · Vigente", avatar: { type: "emoji", text: "🏢" } },
      { who: "Proveedor SpA", what: "ISO 9001", pct: 78, color: "#16A34A", status: "02-03-2027 · Vigente", avatar: { type: "emoji", text: "🏢" } },
      { who: "Proveedor SpA", what: "Certificado ARO", pct: 65, color: "#1D4ED8", status: "30-04-2027 · Vigente", avatar: { type: "emoji", text: "🏢" } },
    ],
  },
  {
    name: "Personal",
    label: "PERSONAL POR ACREDITAR",
    hasAlert: false,
    rows: [
      { who: "Rodrigo Soto", what: "Licencia conducir", pct: 85, color: "#16A34A", status: "✅ 85% · Vigente", avatar: { type: "img", src: "/trab_rodrigo.jpg" } },
      { who: "Matías Rojas", what: "Examen ELA", pct: 40, color: "#BE3A3F", status: "❌ 40% · Vencido", avatar: { type: "img", src: "/trab_matias.jpg" } },
      { who: "José Toro", what: "Psicosensotécnico", pct: 70, color: "#BC7627", status: "⏳ 70% · Por vencer", avatar: { type: "img", src: "/trab_jose.jpg" } },
    ],
  },
  {
    name: "Equipos",
    label: "EQUIPOS POR ACREDITAR",
    hasAlert: false,
    rows: [
      { who: "Excavadora CAT 349D", what: "Certificación de equipo", pct: 88, color: "#16A34A", status: "✅ 88% · Vigente", avatar: { type: "img", src: "/tipo_retroexcavadora.jpeg" } },
      { who: "Camión Pluma 330", what: "Certificación de grúa", pct: 55, color: "#BC7627", status: "⏳ 55% · Por vencer", avatar: { type: "img", src: "/tipo_camionpluma2.jpg" } },
      { who: "Tracto FH #07", what: "Revisión técnica", pct: 25, color: "#BE3A3F", status: "❌ 25% · Vencido", avatar: { type: "img", src: "/tipo_tractocamion.jpeg" } },
    ],
  },
  {
    name: "Alertas",
    label: "ALERTAS ENVIADAS AL CORREO",
    hasAlert: true,
    rows: [
      { who: "Rodrigo Soto", what: "Licencia vence en 5 días", pct: 100, color: "#BE3A3F", status: "✉️ enviado", avatar: { type: "img", src: "/trab_rodrigo.jpg" } },
      { who: "Tracto FH #07", what: "Rev. técnica vence en 12 días", pct: 100, color: "#BC7627", status: "✉️ enviado", avatar: { type: "img", src: "/tipo_tractocamion.jpeg" } },
      { who: "Proveedor SpA", what: "ISO 45001 vence en 20 días", pct: 100, color: "#1D4ED8", status: "✉️ enviado", avatar: { type: "emoji", text: "🏢" } },
    ],
  },
];

/**
 * LandingHeroMockup — Mockup del Panel Ejecutivo interactivo (Día 2).
 * - 6 datasets rotativos con autoplay a 3.200 ms.
 * - Control de pausa visible y accesible (botón, hover, foco, prefers-reduced-motion).
 * - Selección manual de pestañas por click sin perspectiva 3D (H-22).
 */
export default function LandingHeroMockup() {
  const [activeIndex, setActiveIndex] = useState(4); // Inicia en Equipos como en el diseño de referencia
  const [isManualPaused, setIsManualPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Detección de preferencia de movimiento reducido
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

  const nextTab = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % DATASETS.length);
  }, []);

  // Carga y diferimiento de rotación al cliente tras el render inicial (H-01, Tarea 7.2)
  useEffect(() => {
    if (!shouldAutoplay) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const timeout = setTimeout(() => {
      timerRef.current = setInterval(nextTab, 3200);
    }, 1000);

    return () => {
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [shouldAutoplay, nextTab]);

  const currentDataset = DATASETS[activeIndex];

  return (
    <div
      className="relative w-full max-w-[540px] mx-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Marco principal del dashboard */}
      <div className="rounded-[18px] overflow-hidden border border-landing-linea shadow-landing-frame bg-white transition-all">
        {/* Barra superior estilo ventana de aplicación (Chrome) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-landing-linea bg-landing-soft2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
            <div className="ml-2 text-xs font-semibold text-landing-gris flex items-center gap-2">
              ACREDITTIA · Panel Ejecutivo
              <span className="text-landing-verde text-[0.68rem] font-bold">● En vivo</span>
            </div>
          </div>

          {/* Control de pausa visible y accesible (Criterio Día 2) */}
          <button
            type="button"
            onClick={() => setIsManualPaused((prev) => !prev)}
            aria-label={isManualPaused ? "Reanudar rotación del panel" : "Pausar rotación del panel"}
            title={isManualPaused ? "Reanudar rotación automática" : "Pausar rotación automática"}
            className="flex items-center gap-1.5 text-[0.7rem] font-bold px-2 py-0.5 rounded-md border border-landing-linea bg-white text-landing-gris hover:text-landing-ink hover:border-landing-gris2 transition-colors"
          >
            <span aria-hidden="true" className="text-[0.65rem]">{isManualPaused ? "▶" : "⏸"}</span>
            <span className="hidden sm:inline">{isManualPaused ? "Reanudar" : "Pausar"}</span>
          </button>
        </div>

        {/* Pestañas de navegación de datos interactivas (WCAG 2.2 AA, Tarea 8.2) */}
        <div
          role="tablist"
          aria-label="Pestañas del panel ejecutivo"
          className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 border-b border-landing-linea bg-white overflow-x-auto scrollbar-none whitespace-nowrap"
        >
          {DATASETS.map((dataset, idx) => {
            const isActive = activeIndex === idx;
            return (
              <button
                key={dataset.name}
                id={`hero-tab-${idx}`}
                role="tab"
                aria-selected={isActive}
                aria-controls="hero-tabpanel"
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => {
                  setActiveIndex(idx);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    setActiveIndex((idx + 1) % DATASETS.length);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setActiveIndex((idx - 1 + DATASETS.length) % DATASETS.length);
                  }
                }}
                className={`text-[0.72rem] font-bold px-3 py-1 rounded-full transition-all shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-azul focus-visible:ring-offset-1 ${
                  isActive
                    ? "bg-landing-azul text-white shadow-sm"
                    : "text-landing-gris hover:text-landing-ink hover:bg-landing-soft"
                }`}
              >
                {dataset.name}
              </button>
            );
          })}
        </div>

        {/* Cuerpo del dashboard con rol tabpanel accesible */}
        <div
          id="hero-tabpanel"
          role="tabpanel"
          aria-labelledby={`hero-tab-${activeIndex}`}
          className="p-4 sm:p-5"
        >
          <div className="flex justify-between items-baseline gap-2 mb-2.5">
            <span className="text-[0.62rem] sm:text-[0.66rem] font-extrabold tracking-wider text-landing-gris2 uppercase">
              TRABAJADORES EN TODOS TUS CONTRATOS
            </span>
            <b className="text-[0.72rem] sm:text-[0.78rem] text-landing-ink font-extrabold whitespace-nowrap">
              184 trabajadores · 12 contratos
            </b>
          </div>

          {/* Grilla de KPIs en 4 columnas fijas horizontales */}
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5 mb-4">
            <div className="bg-landing-soft rounded-xl p-2 sm:p-2.5 border border-landing-linea/60 text-center sm:text-left">
              <b className="block text-lg sm:text-xl font-extrabold text-landing-verde">142</b>
              <span className="inline-flex sm:flex items-center justify-center sm:justify-start gap-1 text-[0.62rem] sm:text-[0.66rem] font-bold text-landing-gris truncate">
                <i className="w-1.5 h-1.5 rounded-full bg-landing-verde inline-block shrink-0" />
                Acreditados
              </span>
            </div>
            <div className="bg-landing-soft rounded-xl p-2 sm:p-2.5 border border-landing-linea/60 text-center sm:text-left">
              <b className="block text-lg sm:text-xl font-extrabold text-landing-azul">27</b>
              <span className="inline-flex sm:flex items-center justify-center sm:justify-start gap-1 text-[0.62rem] sm:text-[0.66rem] font-bold text-landing-gris truncate">
                <i className="w-1.5 h-1.5 rounded-full bg-landing-azul inline-block shrink-0" />
                En proceso
              </span>
            </div>
            <div className="bg-landing-soft rounded-xl p-2 sm:p-2.5 border border-landing-linea/60 text-center sm:text-left">
              <b className="block text-lg sm:text-xl font-extrabold text-landing-ambar">9</b>
              <span className="inline-flex sm:flex items-center justify-center sm:justify-start gap-1 text-[0.62rem] sm:text-[0.66rem] font-bold text-landing-gris truncate">
                <i className="w-1.5 h-1.5 rounded-full bg-landing-ambar inline-block shrink-0" />
                Vencidos
              </span>
            </div>
            <div className="bg-landing-soft rounded-xl p-2 sm:p-2.5 border border-landing-linea/60 text-center sm:text-left">
              <b className="block text-lg sm:text-xl font-extrabold text-landing-rojo">6</b>
              <span className="inline-flex sm:flex items-center justify-center sm:justify-start gap-1 text-[0.62rem] sm:text-[0.66rem] font-bold text-landing-gris truncate">
                <i className="w-1.5 h-1.5 rounded-full bg-landing-rojo inline-block shrink-0" />
                Bloqueados
              </span>
            </div>
          </div>

          {/* Barra acumulada */}
          <div
            className="flex h-2 rounded-full overflow-hidden mb-4 bg-landing-linea"
            title="142 acreditados · 27 en proceso · 9 vencidos · 6 bloqueados"
          >
            <i style={{ width: "77.2%" }} className="block h-full bg-landing-verde" />
            <i style={{ width: "14.7%" }} className="block h-full bg-landing-azul" />
            <i style={{ width: "4.9%" }} className="block h-full bg-landing-ambar" />
            <i style={{ width: "3.2%" }} className="block h-full bg-landing-rojo" />
          </div>

          {/* Etiqueta dinámica de la lista según dataset activo */}
          <div className="text-[0.64rem] sm:text-[0.66rem] font-extrabold tracking-wider text-landing-gris2 uppercase mb-2.5 transition-colors">
            {currentDataset.label}
          </div>

          {/* Lista dinámica de filas */}
          <div className="flex flex-col gap-2.5 min-h-[110px] transition-all">
            {currentDataset.rows.map((row, idx) => (
              <div
                key={`${row.who}-${idx}`}
                className="grid grid-cols-[28px_1fr_1fr_1.1fr_auto] items-center gap-2 sm:gap-2.5 text-[0.74rem] animate-plat-fade"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full overflow-hidden bg-landing-soft border border-landing-linea shrink-0 relative flex items-center justify-center text-xs">
                  {row.avatar.type === "img" && row.avatar.src ? (
                    <Image
                      src={row.avatar.src}
                      alt={row.who}
                      fill
                      sizes="28px"
                      className="object-cover"
                      priority
                    />
                  ) : row.avatar.type === "emoji" ? (
                    <span>{row.avatar.text}</span>
                  ) : (
                    <span className="font-bold text-white text-[0.62rem]" style={{ backgroundColor: row.avatar.bg || "#64748B" }}>
                      {row.avatar.text}
                    </span>
                  )}
                </div>

                {/* Quién */}
                <span className="font-extrabold text-landing-ink truncate">{row.who}</span>

                {/* Qué */}
                <span className="text-landing-gris truncate text-[0.72rem]">{row.what}</span>

                {/* Barra de progreso */}
                <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                  <div
                    style={{ width: `${row.pct}%`, backgroundColor: row.color }}
                    className="h-full rounded-full transition-all duration-500"
                  />
                </div>

                {/* Estado o Días */}
                <span className="font-bold text-landing-ink text-right whitespace-nowrap text-[0.7rem] sm:text-[0.72rem]">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerta flotante animada — se muestra cuando el dataset tiene hasAlert (o en la pestaña Alertas) */}
      <div
        className={`absolute -bottom-4 -right-2 sm:-right-4 bg-white rounded-2xl p-3 sm:px-4 sm:py-3 shadow-[0_14px_34px_rgba(13,27,42,.18)] border border-landing-linea flex items-center gap-3 text-xs max-w-[240px] pointer-events-none z-10 transition-all duration-300 ${
          currentDataset.hasAlert
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-3 scale-95 pointer-events-none"
        }`}
      >
        <span className="text-lg shrink-0">✉️</span>
        <div>
          <b className="block text-landing-ink font-bold text-[0.78rem]">Alerta enviada</b>
          <span className="block text-landing-gris2 text-[0.66rem]">a tu correo, automáticamente</span>
        </div>
      </div>
    </div>
  );
}

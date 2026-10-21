"use client";
import React from "react";

/**
 * Las 11 secciones del contrato que exige la plataforma, más las dos que ya
 * existían y siguen vivas (Requisitos e Historial).
 */
export const TABS = [
  "Resumen",
  "Chat",
  "Documentos",
  "Documentos Faena",
  "Carpeta de Arranque",
  "Empresa",
  "Personal",
  "Vehículos / Equipos",
  "Licencia Interna",
  "Agentes",
  "Alertas IA",
  "Requisitos",
  "Historial",
] as const;

export type Tab = (typeof TABS)[number];

/** Icono por pestaña: con trece secciones el rótulo solo no basta para escanear. */
export const ICONO_TAB: Record<Tab, string> = {
  "Resumen": "📊",
  "Chat": "💬",
  "Documentos": "📁",
  "Documentos Faena": "📘",
  "Carpeta de Arranque": "🗂️",
  "Empresa": "🏢",
  "Personal": "👷",
  "Vehículos / Equipos": "🚛",
  "Licencia Interna": "🪪",
  "Agentes": "🤖",
  "Alertas IA": "🔔",
  "Requisitos": "📑",
  "Historial": "🕘",
};

/** Slug estable de la pestaña en la URL (`?tab=licencia-interna`). */
export function slugTab(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Pestaña a partir del slug de la URL; null si no corresponde a ninguna. */
export function tabDesdeSlug(s: string | null | undefined): Tab | null {
  if (!s) return null;
  const norm = slugTab(s);
  return (TABS.find((t) => slugTab(t) === norm) as Tab | undefined) ?? null;
}

interface ContratoTabsProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  colorTheme?: string;
}

export function ContratoTabs({ currentTab, onTabChange, colorTheme = "bg-blue-600" }: ContratoTabsProps) {
  // Color del tab activo derivado del tema del mandante (clases completas para el JIT).
  const textColor = colorTheme.replace("bg-", "text-");
  const borderColor = colorTheme.replace("bg-", "border-b-");

  return (
    <div
      role="tablist"
      aria-label="Secciones del contrato"
      className="flex bg-white border border-slate-200 border-b-2 rounded-t-2xl overflow-x-auto overflow-y-hidden tabs-scroll mb-5"
    >
      {TABS.map((t) => {
        const isActive = currentTab === t;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${slugTab(t)}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(t)}
            title={t}
            className={`px-3 py-[13px] text-[0.8rem] font-semibold whitespace-nowrap bg-white transition-colors border-b-[3px] -mb-[2px] box-border cursor-pointer inline-flex items-center gap-1.5 ${
              isActive
                ? `${borderColor} ${textColor} bg-slate-50/70`
                : "border-b-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50"
            }`}
          >
            <span aria-hidden="true" className="text-[0.9rem] leading-none">
              {ICONO_TAB[t]}
            </span>
            {t}
          </button>
        );
      })}
    </div>
  );
}

"use client";
import React from "react";

export const TABS = [
  "Resumen",
  "Chat",
  "Documentos",
  "Documentos Faena",
  "Carpeta de Arranque",
  "Empresa",
  "Personal",
  "Licencia Interna",
  "Alertas",
  "Requisitos",
  "Historial",
  "Vehículos / Equipos",
] as const;

export type Tab = (typeof TABS)[number];

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
      className="flex bg-white border border-slate-200 border-b-2 rounded-t-2xl overflow-x-auto tabs-scroll mb-5"
    >
      {TABS.map((t) => {
        const isActive = currentTab === t;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(t)}
            className={`px-3 py-[13px] text-[0.8rem] font-semibold whitespace-nowrap bg-white transition-colors border-b-[3px] -mb-[2px] cursor-pointer ${
              isActive
                ? `${borderColor} ${textColor}`
                : "border-b-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

"use client";
import React from "react";

export const TABS = [
  "Documentos",
  "Documentos Faena",
  "Carpeta de Arranque",
  "Empresa",
  "Personal",
  "Vehículos / Equipos",
  "Alertas",
] as const;

export type Tab = (typeof TABS)[number];

interface ContratoTabsProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  colorTheme?: string;
}

export function ContratoTabs({ currentTab, onTabChange, colorTheme = "bg-blue-600" }: ContratoTabsProps) {
  // Determine color for the active tab bottom border based on colorTheme class
  const textColor = colorTheme.replace("bg-", "text-");
  const borderColor = colorTheme.replace("bg-", "border-b-");

  return (
    <div className="flex gap-1 border-b-2 border-slate-200 mb-5 bg-transparent overflow-x-auto">
      {TABS.map((t) => {
        const isActive = currentTab === t;
        return (
          <div 
            key={t} 
            onClick={() => onTabChange(t)}
            className={`px-5 py-3.5 text-[0.83rem] font-semibold cursor-pointer border-b-[3px] whitespace-nowrap bg-white transition-all ${
              isActive 
                ? `${borderColor} ${textColor}` 
                : "border-b-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </div>
        );
      })}
    </div>
  );
}

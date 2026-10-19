"use client";

import React from "react";
import Image from "next/image";

/**
 * LandingHeroMockup — Mockup del Panel Ejecutivo de Acredittia (líneas 747-777).
 * - Enfoque 100% plano sin perspectiva 3D (H-22).
 * - Componentes visuales: barra chrome, pestañas, KPIs, barra apilada, lista y alerta flotante.
 * - Preparado para interactividad completa de 6 datasets en el Día 2.
 */
export default function LandingHeroMockup() {
  return (
    <div className="relative w-full max-w-[540px] mx-auto">
      {/* Marco principal del dashboard */}
      <div className="rounded-[18px] overflow-hidden border border-landing-linea shadow-landing-frame bg-white">
        {/* Barra superior estilo ventana de aplicación (Chrome) */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-landing-linea bg-landing-soft2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
          <div className="ml-2 text-xs font-semibold text-landing-gris flex items-center gap-2">
            ACREDITTIA · Panel Ejecutivo
            <span className="text-landing-verde text-[0.68rem] font-bold">● En vivo</span>
          </div>
        </div>

        {/* Pestañas de navegación de datos (en una sola línea) */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2.5 border-b border-landing-linea bg-white overflow-x-auto scrollbar-none whitespace-nowrap">
          <span className="text-[0.72rem] font-bold text-landing-gris px-3 py-1 rounded-full transition-colors cursor-default shrink-0">
            Panel
          </span>
          <span className="text-[0.72rem] font-bold text-landing-gris px-3 py-1 rounded-full transition-colors cursor-default shrink-0">
            Contratos
          </span>
          <span className="text-[0.72rem] font-bold text-landing-gris px-3 py-1 rounded-full transition-colors cursor-default shrink-0">
            Empresa
          </span>
          <span className="text-[0.72rem] font-bold text-landing-gris px-3 py-1 rounded-full transition-colors cursor-default shrink-0">
            Personal
          </span>
          <span className="text-[0.72rem] font-bold bg-landing-azul text-white px-3 py-1 rounded-full shadow-sm shrink-0">
            Equipos
          </span>
          <span className="text-[0.72rem] font-bold text-landing-gris px-3 py-1 rounded-full transition-colors cursor-default shrink-0">
            Alertas
          </span>
        </div>

        {/* Cuerpo del dashboard */}
        <div className="p-4 sm:p-5">
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
            className="flex h-2 rounded-full overflow-hidden mb-5 bg-landing-linea"
            title="142 acreditados · 27 en proceso · 9 vencidos · 6 bloqueados"
          >
            <i style={{ width: "77.2%" }} className="block h-full bg-landing-verde" />
            <i style={{ width: "14.7%" }} className="block h-full bg-landing-azul" />
            <i style={{ width: "4.9%" }} className="block h-full bg-landing-ambar" />
            <i style={{ width: "3.2%" }} className="block h-full bg-landing-rojo" />
          </div>

          {/* Lista de equipos */}
          <div className="text-[0.66rem] font-extrabold tracking-wider text-landing-gris2 uppercase mb-3">
            EQUIPOS POR ACREDITAR
          </div>

          <div className="flex flex-col gap-3">
            {/* Fila 1 */}
            <div className="grid grid-cols-[28px_1fr_1fr_1.1fr_auto] items-center gap-2 sm:gap-2.5 text-[0.74rem]">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-landing-soft border border-landing-linea shrink-0 relative">
                <Image
                  src="/tipo_retroexcavadora.jpeg"
                  alt="Excavadora CAT 349D"
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </div>
              <span className="font-extrabold text-landing-ink truncate">Excavadora CAT 349D</span>
              <span className="text-landing-gris truncate">Certificación de equipo</span>
              <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                <div style={{ width: "88%" }} className="h-full bg-landing-verde rounded-full" />
              </div>
              <span className="font-bold text-landing-ink text-right whitespace-nowrap text-[0.72rem]">
                ✅ 88% · Vigente
              </span>
            </div>

            {/* Fila 2 */}
            <div className="grid grid-cols-[28px_1fr_1fr_1.1fr_auto] items-center gap-2 sm:gap-2.5 text-[0.74rem]">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-landing-soft border border-landing-linea shrink-0 relative">
                <Image
                  src="/tipo_camionpluma2.jpg"
                  alt="Camión Pluma 330"
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </div>
              <span className="font-extrabold text-landing-ink truncate">Camión Pluma 330</span>
              <span className="text-landing-gris truncate">Certificación de grúa</span>
              <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                <div style={{ width: "55%" }} className="h-full bg-landing-ambar rounded-full" />
              </div>
              <span className="font-bold text-landing-ink text-right whitespace-nowrap text-[0.72rem]">
                ⏳ 55% · Por vencer
              </span>
            </div>

            {/* Fila 3 */}
            <div className="grid grid-cols-[28px_1fr_1fr_1.1fr_auto] items-center gap-2 sm:gap-2.5 text-[0.74rem]">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-landing-soft border border-landing-linea shrink-0 relative">
                <Image
                  src="/tipo_tractocamion.jpeg"
                  alt="Tracto FH #07"
                  fill
                  sizes="28px"
                  className="object-cover"
                />
              </div>
              <span className="font-extrabold text-landing-ink truncate">Tracto FH #07</span>
              <span className="text-landing-gris truncate">Revisión técnica</span>
              <div className="h-1.5 rounded-full bg-landing-linea overflow-hidden">
                <div style={{ width: "25%" }} className="h-full bg-landing-rojo rounded-full" />
              </div>
              <span className="font-bold text-landing-ink text-right whitespace-nowrap text-[0.72rem]">
                ❌ 25% · Vencido
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Alerta flotante animada */}
      <div className="absolute -bottom-4 -right-2 sm:-right-4 bg-white rounded-2xl p-3 sm:px-4 sm:py-3 shadow-[0_14px_34px_rgba(13,27,42,.18)] border border-landing-linea flex items-center gap-3 text-xs max-w-[240px] pointer-events-none animate-hv-mail-pop z-10">
        <span className="text-lg shrink-0">✉️</span>
        <div>
          <b className="block text-landing-ink font-bold text-[0.78rem]">Alerta enviada</b>
          <span className="block text-landing-gris2 text-[0.66rem]">a tu correo, automáticamente</span>
        </div>
      </div>
    </div>
  );
}

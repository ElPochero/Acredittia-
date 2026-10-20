"use client";

import React from "react";
import LandingNav from "./LandingNav";
import LandingHero from "./LandingHero";
import LandingProblema from "./LandingProblema";
import LandingPlataforma from "./LandingPlataforma";
import LandingParaQuien from "./LandingParaQuien";
import LandingStats from "./LandingStats";
import LandingFunciones from "./LandingFunciones";
import LandingAlertas from "./LandingAlertas";
import LandingIndustrias from "./LandingIndustrias";
import LandingFaenas from "./LandingFaenas";
import LandingAgentes from "./LandingAgentes";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingPage — Orquestador de la landing con diseño alternativo (Día 3).
 * Integra Nav, Hero, Problema, Plataforma, ParaQuién, Stats, Funciones, Alertas,
 * Industrias, Faenas y Agentes.
 */
export default function LandingPage() {
  return (
    <div id="landing" className="min-h-screen bg-white text-landing-ink font-landing-sans antialiased">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProblema />
        <LandingPlataforma />
        <LandingParaQuien />
        <LandingStats />
        <LandingFunciones />
        <LandingAlertas />
        <LandingIndustrias />

        {/* Punto de ancla para flujo (se implementa el Día 4) */}
        <div id={LANDING_SECTIONS.FLUJO} className="scroll-mt-20" />

        <LandingFaenas />
        <LandingAgentes />

        {/* Puntos de ancla para enlaces de navegación durante el desarrollo incremental (Días 4 y 5) */}
        <div id={LANDING_SECTIONS.BENEFICIADOS} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.CONTACT} className="scroll-mt-20" />
      </main>
    </div>
  );
}

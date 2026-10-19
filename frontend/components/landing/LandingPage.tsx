"use client";

import React from "react";
import LandingNav from "./LandingNav";
import LandingHero from "./LandingHero";
import LandingProblema from "./LandingProblema";
import LandingPlataforma from "./LandingPlataforma";
import LandingParaQuien from "./LandingParaQuien";
import LandingStats from "./LandingStats";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingPage — Orquestador de la landing con diseño alternativo (Día 2).
 * Integra Nav, Hero, Problema, Plataforma, ParaQuién y Stats.
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

        {/* Puntos de ancla para enlaces de navegación durante el desarrollo incremental (Días 3 y 4) */}
        <div id={LANDING_SECTIONS.FLUJO} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.AGENTES} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.FAENAS} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.BENEFICIADOS} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.CONTACT} className="scroll-mt-20" />
      </main>
    </div>
  );
}

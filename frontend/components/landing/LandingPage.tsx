"use client";

import React from "react";
import LandingNav from "./LandingNav";
import LandingHero from "./LandingHero";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingPage — Orquestador de la landing con diseño alternativo (Día 1).
 * Monta Nav y Hero completos, y preserva anclas de destino para navegación limpia.
 */
export default function LandingPage() {
  return (
    <div id="landing" className="min-h-screen bg-white text-landing-ink font-landing-sans antialiased">
      <LandingNav />
      <main>
        <LandingHero />

        {/* Puntos de ancla para enlaces de navegación durante el desarrollo incremental */}
        <div id={LANDING_SECTIONS.FLUJO} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.PLATAFORMA} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.AGENTES} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.FAENAS} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.BENEFICIADOS} className="scroll-mt-20" />
        <div id={LANDING_SECTIONS.CONTACT} className="scroll-mt-20" />
      </main>
    </div>
  );
}

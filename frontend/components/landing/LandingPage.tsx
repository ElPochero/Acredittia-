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
import LandingFlujo from "./LandingFlujo";
import LandingFaenas from "./LandingFaenas";
import LandingAgentes from "./LandingAgentes";
import LandingCtaFinal from "./LandingCtaFinal";
import LandingContacto from "./LandingContacto";
import LandingFooter from "./LandingFooter";
import { LANDING_SECTIONS } from "./sections";

/**
 * LandingPage — Orquestador de la landing con diseño alternativo (Día 4).
 * Integra Nav, Hero, Problema, Plataforma, ParaQuién, Stats, Funciones, Alertas,
 * Industrias, Flujo, Faenas, Agentes, CTA Final, Contacto y Footer.
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
        <LandingFlujo />
        <LandingFaenas />
        <LandingAgentes />

        {/* Punto de ancla para beneficiados durante desarrollo incremental (Día 5) */}
        <div id={LANDING_SECTIONS.BENEFICIADOS} className="scroll-mt-20" />

        <LandingCtaFinal />
        <LandingContacto />
      </main>
      <LandingFooter />
    </div>
  );
}

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
import LandingCarpetas from "./LandingCarpetas";
import LandingEcosistema from "./LandingEcosistema";
import LandingPlanilla from "./LandingPlanilla";
import LandingFaenas from "./LandingFaenas";
import LandingAgentes from "./LandingAgentes";
import LandingImpacto from "./LandingImpacto";
import LandingBeneficiados from "./LandingBeneficiados";
import LandingTrust from "./LandingTrust";
import LandingCtaFinal from "./LandingCtaFinal";
import LandingContacto from "./LandingContacto";
import LandingFooter from "./LandingFooter";

/**
 * LandingPage — Orquestador de la landing con diseño alternativo (Día 6).
 * Integra las 18 secciones de contenido completas según el diseño de referencia:
 * Nav, Hero, Problema, Plataforma, ParaQuién, Stats, Funciones, Alertas, Industrias,
 * Flujo, Carpetas, Ecosistema, Planilla, Faenas, Agentes, Impacto, Beneficiados,
 * Trust, CTA Final, Contacto y Footer.
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
        <LandingCarpetas />
        <LandingEcosistema />
        <LandingPlanilla />
        <LandingFaenas />
        <LandingAgentes />
        <LandingImpacto />
        <LandingBeneficiados />
        <LandingTrust />
        <LandingCtaFinal />
        <LandingContacto />
      </main>
      <LandingFooter />
    </div>
  );
}

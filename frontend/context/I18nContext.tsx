"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { translationsEn, translationsEs } from "@/lib/platform/i18n-dictionary";

export type Language = "es" | "en";

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "es",
  setLang: () => {},
  t: (key, fallback) => fallback || key,
});

// Comprehensive translation helper for any text fragment
export function translateTextToEn(text: string): string {
  if (!text || typeof text !== "string") return text;
  let t = text;

  // Complete phrases dictionary
  const phraseMap: [string, string][] = [
    ["Todos ganan cuando la acreditación funciona.", "Everyone wins when accreditation works smoothly."],
    ["La acreditación no depende de una sola persona — pasa por la faena, por quien lidera las acreditaciones en la empresa, por el administrador de cada contrato y por el propio trabajador.", "Accreditation doesn’t depend on a single person — it involves the site, compliance managers, contract managers, and workers."],
    ["A las faenas y mandantes", "To Work Sites & Operators"],
    ["Ayudamos a que sus empresas proveedoras acrediten más fácil, más claro y con muchos menos errores.", "We help contractor companies accredit faster, clearer, and with far fewer errors."],
    ["Si un proveedor no está acreditado, la faena no opera", "If a provider is not accredited, the site cannot operate."],
    ["Al jefe de acreditaciones", "To the Head of Accreditation"],
    ["Visualiza todos los contratos de la empresa en un solo panel: cumplimiento, requisitos pendientes y % de acreditación por faena, en tiempo real", "View all company contracts in a single dashboard: compliance, pending requirements, and accreditation % per site in real time"],
    ["Al administrador de contrato", "To the Contract Manager"],
    ["Maneja la acreditación de su contrato desde un solo lugar, sin tener que andar apurando ni molestando a los trabajadores", "Manage contract compliance from a single place without chasing workers"],
    ["Al trabajador", "To the Worker"],
    ["Tiene su propio Agente IA que le solicita los documentos", "Has their own AI Agent requesting documents"],
    ["Acreditación con IA, sin transformar tu equipo.", "AI Accreditation without disrupting your team."],
    ["Detecta vencimientos, contacta al trabajador y actualiza el contrato antes de que llegue a garita.", "Detects expirations, contacts workers, and updates contracts before arriving at the gate."],
    ["Tu equipo ya no tiene que perseguir a nadie. Los Agentes IA lo hacen.", "Your team no longer has to chase anyone. AI Agents handle it."],
    ["No somos solo una plataforma que revisa documentos.", "We are not just a document review platform."],
    ["Cada trabajador tiene un Agente Acreditador IA", "Every worker has a dedicated AI Accrediting Agent."],
    ["La acreditación tradicional pone en riesgo tu operación", "Traditional accreditation puts your operation at risk"],
    ["Atrasos en garita", "Gate Delays"],
    ["Multas reglamentarias", "Regulatory Fines"],
    ["Sobrecarga del personal", "Staff Overload"],
    ["Brechas de seguridad", "Safety Gaps"],
    ["Cumplimiento adaptado a industrias exigentes", "Compliance tailored to high-stakes industries"],
    ["Sube tu Excel. La IA hace la magia.", "Upload your Excel. AI does the rest."],
    ["Sube tu Excel", "Upload your Excel"],
    ["La IA lee tus datos", "AI parses your data"],
    ["Usa la plataforma, no el Excel", "Use the platform, not Excel"],
    ["Faenas 100% integradas. Un solo lugar para acreditar.", "100% integrated work sites. One place to accredit."],
    ["En estas 9 faenas ya tenemos el flujo y las plataformas", "In these 9 sites we already have full workflow and platform integration"],
    ["Gran Minería", "Mining Operations"],
    ["Energía & Renovables", "Energy & Renewables"],
    ["Construcción", "Construction"],
    ["Agroindustria", "Agribusiness"],
    ["Acuicultura", "Aquaculture"],
    ["Plataforma tradicional vs Acredittia", "Traditional Platform vs Acredittia"],
    ["Forma Tradicional", "Traditional Method"],
    ["Con Acredittia", "With Acredittia"],
    ["Revisión manual y plataformas lentas", "Manual reviews and slow legacy software"],
    ["Agentes IA autónomos y validación instantánea", "Autonomous AI agents and instant verification"],
    ["¿Listo para acelerar tu acreditación?", "Ready to streamline your accreditation?"],
    ["Empezar prueba gratis →", "Start free trial →"],
    ["Iniciar sesión", "Log in"],
    ["Empezar gratis →", "Start for free →"],
    ["Empezar gratis", "Start for free"],
    ["Ver demostración", "Watch demo"],
    ["Agentes IA", "AI Agents"],
    ["Red Autorizada", "Authorized Network"],
    ["Sectores", "Sectors"],
    ["La Plataforma", "The Platform"]
  ];

  for (const [es, en] of phraseMap) {
    if (t.includes(es)) {
      t = t.replace(new RegExp(es.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), en);
    }
  }

  // Common vocabulary replacements
  const words: [RegExp, string][] = [
    [/\bAcredittia\b/gi, "Acredittia"],
    [/\bAcreditación\b/gi, "Accreditation"],
    [/\bacreditaciones\b/gi, "accreditations"],
    [/\bacreditación\b/gi, "accreditation"],
    [/\bacreditar\b/gi, "accredit"],
    [/\bacreditados?\b/gi, "accredited"],
    [/\bTrabajadores\b/gi, "Workers"],
    [/\bTrabajador\b/gi, "Worker"],
    [/\btrabajadores\b/gi, "workers"],
    [/\btrabajador\b/gi, "worker"],
    [/\bContratistas\b/gi, "Contractors"],
    [/\bContratista\b/gi, "Contractor"],
    [/\bcontratistas\b/gi, "contractors"],
    [/\bcontratista\b/gi, "contractor"],
    [/\bProveedores\b/gi, "Providers"],
    [/\bProveedor\b/gi, "Provider"],
    [/\bproveedores\b/gi, "providers"],
    [/\bproveedor\b/gi, "provider"],
    [/\bFaenas\b/gi, "Work Sites"],
    [/\bFaena\b/gi, "Work Site"],
    [/\bfaenas\b/gi, "work sites"],
    [/\bfaena\b/gi, "work site"],
    [/\bMandantes\b/gi, "Operators"],
    [/\bMandante\b/gi, "Operator"],
    [/\bmandantes\b/gi, "operators"],
    [/\bmandante\b/gi, "operator"],
    [/\bRequisitos\b/gi, "Requirements"],
    [/\bRequisito\b/gi, "Requirement"],
    [/\brequisitos\b/gi, "requirements"],
    [/\brequisito\b/gi, "requirement"],
    [/\bVencimientos\b/gi, "Expirations"],
    [/\bVencimiento\b/gi, "Expiration"],
    [/\bvencimientos\b/gi, "expirations"],
    [/\bvencimiento\b/gi, "expiration"],
    [/\bVencido\b/gi, "Expired"],
    [/\bvencido\b/gi, "expired"],
    [/\bAprobado\b/gi, "Approved"],
    [/\baprobado\b/gi, "approved"],
    [/\bPendiente\b/gi, "Pending"],
    [/\bpendiente\b/gi, "pending"],
    [/\bRechazado\b/gi, "Rejected"],
    [/\brechazado\b/gi, "rejected"],
    [/\bCumplimiento\b/gi, "Compliance"],
    [/\bcumplimiento\b/gi, "compliance"],
    [/\bDocumentación\b/gi, "Documentation"],
    [/\bdocumentación\b/gi, "documentation"],
    [/\bDocumentos\b/gi, "Documents"],
    [/\bdocumentos\b/gi, "documents"],
    [/\bValidación\b/gi, "Validation"],
    [/\bvalidación\b/gi, "validation"],
    [/\bMinería\b/gi, "Mining"],
    [/\bminería\b/gi, "mining"],
    [/\bEnergía\b/gi, "Energy"],
    [/\benergía\b/gi, "energy"],
    [/\bConstrucción\b/gi, "Construction"],
    [/\bconstrucción\b/gi, "construction"],
    [/\bgarita\b/gi, "access gate"],
    [/\bGarita\b/gi, "Access Gate"]
  ];

  for (const [pattern, replacement] of words) {
    t = t.replace(pattern, replacement);
  }

  return t;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("es");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("acredittia_lang") as Language;
      if (saved === "es" || saved === "en") {
        setLangState(saved);
      }
    } catch (e) {
      // Ignore SSR/storage restriction errors
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("acredittia_lang", newLang);
    } catch (e) {
      console.error("Failed to save language preference:", e);
    }
  };

  useEffect(() => {
    const updateElements = () => {
      // 1. Update elements with data-i18n attributes
      const elements = document.querySelectorAll<HTMLElement>("[data-i18n]");
      elements.forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (!key) return;

        if (!el.getAttribute("data-i18n-es")) {
          el.setAttribute("data-i18n-es", el.innerHTML);
        }

        if (lang === "es") {
          const origEs = el.getAttribute("data-i18n-es");
          if (origEs) {
            el.innerHTML = origEs;
          } else if (translationsEs[key]) {
            el.innerHTML = translationsEs[key];
          }
        } else if (lang === "en") {
          if (translationsEn[key]) {
            el.innerHTML = translationsEn[key];
          } else {
            const origEs = el.getAttribute("data-i18n-es") || el.innerHTML;
            el.innerHTML = translateTextToEn(origEs);
          }
        }
      });

      // 2. Traversal pass over text nodes to translate elements without data-i18n
      const container = document.getElementById("landing") || document.body;
      const walkTextNodes = (node: Node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const val = node.nodeValue;
          if (!val || val.trim().length === 0) return;

          if (!(node as any).__origEs) {
            (node as any).__origEs = val;
          }

          if (lang === "es") {
            if ((node as any).__origEs) {
              node.nodeValue = (node as any).__origEs;
            }
          } else if (lang === "en") {
            const orig = (node as any).__origEs || val;
            node.nodeValue = translateTextToEn(orig);
          }
          return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (
            ["SCRIPT", "STYLE", "SVG", "PATH", "CODE", "INPUT", "TEXTAREA"].includes(el.tagName) ||
            el.hasAttribute("data-i18n")
          ) {
            return;
          }

          for (let i = 0; i < el.childNodes.length; i++) {
            walkTextNodes(el.childNodes[i]);
          }
        }
      };

      walkTextNodes(container);
    };

    updateElements();
    const timer1 = setTimeout(updateElements, 100);
    const timer2 = setTimeout(updateElements, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [lang]);

  const t = (key: string, fallback?: string) => {
    if (lang === "en" && translationsEn[key]) {
      return translationsEn[key];
    }
    if (translationsEs[key]) {
      return translationsEs[key];
    }
    return fallback || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

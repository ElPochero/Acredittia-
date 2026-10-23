/**
 * Identificadores de ancla canónicos de la Landing Page.
 * Fuente única de verdad para navegación, footer y pruebas de contrato.
 */
export const LANDING_SECTIONS = {
  FLUJO: "flujo",
  PLATAFORMA: "plataforma",
  AGENTES: "agentes",
  FAENAS: "faenas",
  BENEFICIADOS: "beneficiados",
  CONTACT: "contact",
} as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[keyof typeof LANDING_SECTIONS];

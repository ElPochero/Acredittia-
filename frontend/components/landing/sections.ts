/**
 * Identificadores de ancla canónicos de la Landing Page.
 * Fuente única de verdad para navegación, footer y pruebas de contrato.
 * 
 * Reglas de Scroll (H-15, H-40, Tarea 7.4):
 * - Todas las anclas implementan `scroll-margin-top: 5rem` (`scroll-mt-20`) para no ser cubiertas por el navbar.
 * - Sin `overflow-x: hidden` global ni `transform` en la raíz `#landing` para preservar restauración nativa de scroll.
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

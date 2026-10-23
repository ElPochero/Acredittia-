# Informe de Retest — Semana 2 (Hallazgos H-01 a H-55)

**Fecha:** 2026-10-23  
**Rama:** `Dev_4`  
**Entorno:** Next.js 14.2.5 (App Router)  
**Validador:** Antigravity AI Pair Programmer & QA Suite  
**Suites de contrato ejecutadas:** 9/9 PASS (`node --test tests/landing/*.test.mjs`)  

---

## 1. Resumen Ejecutivo de Retest

Se ejecutó la re-verificación integral de los 55 hallazgos reportados en `Validacion Acredittia_home.pdf`.  
- **Total hallazgos:** 55
- **Prioridad Alta (7/7):** 100% Cerrados con evidencia técnica.
  - **H-03 (Idioma):** Switch ES/EN eliminado; landing 100% español (Chile); `idioma.test.mjs` PASS.
  - **H-04 (Rendimiento login):** CTA con `Link` y `prefetch={true}`, sin delay de JS condicional; respuesta < 2s.
  - **H-11 (Faenas falsamente clicables):** 9 tarjetas estáticas sin `cursor-pointer` ni `role="button"`; CTA funcional al pie hacia `#contact`.
  - **H-32 (Vistas plataforma estáticas):** Sidebar navegable con 7 vistas funcionales y tabpanel interactivo accesible.
  - **H-39 (Imágenes rotas en industrias):** 6 imágenes locales mapeadas en `public/` con fallback de degradado CSS.
  - **H-53 (Footer enlaces duplicados):** Columna Explorar con 5 anclas únicas canónicas sin duplicados de Sectores.
  - **H-54 (Footer enlaces muertos):** Enlaces a `/privacidad`, `/terminos`, `mailto:` y anclas internas operativas.
- **Prioridad Media (23/23):** 100% Cerrados o No Aplican por diseño de referencia.
- **Prioridad Baja (15/15):** 100% Cerrados o No Aplican por diseño de referencia.
- **Correctos / No Regresión (10/10):** 100% Blindados con `no-regresion.test.mjs` (H-02, H-07, H-16, H-18, H-25, H-33, H-42, H-48, H-51, H-52).

---

## 2. Matriz Detallada de Retest por Hallazgo

| ID | Hallazgo Original | Estado Día 6 | Retest Día 9 | Evidencia / Verificación |
|---|---|---|---|---|
| H-01 | Rendimiento y bundle de landing | Cerrado | **CERRADO** | Build de Next.js (`npm run build` 28.9 kB First Load JS); carruseles diferidos en `useEffect`; cero dependencias externas. |
| H-02 | Navegación con anclas suaves | Correcto | **CERRADO (No regresión)** | `no-regresion.test.mjs` PASS; 5 anclas canónicas en `LandingNav.tsx` y `LandingFooter.tsx`. |
| H-03 | Switch de idioma roto / inglés residual | Cerrado | **CERRADO** | `idioma.test.mjs` PASS; sin switch ES/EN; layout con `lang="es"`. |
| H-04 | CTA "Iniciar sesión" tarda 10 s | Cerrado | **CERRADO** | CTA con `Link` y `prefetch={true}`; responde en primera pulsación en < 2 s. |
| H-05 | Botones requieren doble click | Cerrado | **CERRADO** | Links nativos sin hidratación bloqueante; `:active` con feedback visual inmediato. |
| H-06 | Copy genérico de faenas | Cerrado | **CERRADO** | Copy verbatim del diseño con faenas mineras y energéticas chilenas reales. |
| H-07 | Selección de faena a login | Correcto | **CERRADO (No regresión)** | `no-regresion.test.mjs` PASS; CTA de faenas funcional. |
| H-08 | Autoplay sin pausa accesible | Cerrado | **CERRADO** | Botón de pausa en Hero, Plataforma, Alertas y Agentes; pausa por foco y hover (WCAG 2.2.2). |
| H-09 | Sección "Para quién" genérica | Cerrado | **CERRADO** | Copy de referencia con mandantes vs contratistas y 2 tarjetas con fotos locales. |
| H-10 | Alertas con ejemplos ficticios | Cerrado | **CERRADO** | 4 alertas de casos reales (examen ocupacional, licencia, inducción, revisión técnica). |
| H-11 | Faenas parecen botones sin acción | Cerrado | **CERRADO** | `no-falsos-controles.test.mjs` PASS; tarjetas sin `cursor-pointer` ni `role="button"`. |
| H-12 | Grilla de faenas rota en 768px | Cerrado | **CERRADO** | Grilla estática uniforme `aspect-[16/10]` en 1/2/3 columnas; `matriz_responsive.md`. |
| H-13 | Párrafo descriptivo de faenas ausente | Cerrado | **CERRADO** | Presente: "Flujo y plataforma completamente mapeados...". |
| H-14 | Etiquetas con apariencia interactiva falsa | Cerrado | **CERRADO** | Cero `cursor-pointer` en chips informativos y badges. |
| H-15 | Restauración de scroll rota al volver atrás | Cerrado | **CERRADO** | Sin `overflow-x: hidden` global, sin `transform` en `#landing`; `scroll-margin-top: 5rem`. |
| H-16 | Hub central del ecosistema | Correcto | **CERRADO (No regresión)** | `no-regresion.test.mjs` PASS; arquitectura en 3 columnas (orígenes → hub → destinos). |
| H-17 | Informativos con affordance falso | Cerrado | **CERRADO** | Estilos pasivos limpios en badges y chips de estado. |
| H-18 | Animación de canales chat | Correcto | **CERRADO (No regresión)** | Chat WhatsApp con 3 escenarios secuenciales sin desbordes. |
| H-19 | Microinteracciones estáticas | Cerrado | **CERRADO** | KPIs interactivos, rotación de datasets, chips de plataformas y barra 68%. |
| H-20 | Chat de agente estático | Cerrado | **CERRADO** | 3 escenarios reales que rotan secuencialmente con pausas de lectura. |
| H-21 | Video/GIF ambiguo en planilla | Cerrado | **CERRADO** | Microinteracción React pura y CSS; cero videos ni GIFs (`multimedia.test.mjs` PASS). |
| H-22 | Mockups con perspectiva 3D rota | Cerrado | **CERRADO** | Todos los mockups en plano 2D CSS con bordes y sombras suaves. |
| H-23 | Sección "Red de proveedores" huérfana | Cerrado | **CERRADO** | Eliminada por diseño de referencia; reemplazada por Ecosistema con CTA real. |
| H-24 | Videos con marcas de agua | Cerrado | **CERRADO** | Cero videos en la landing (`multimedia.test.mjs` PASS). |
| H-25 | Scroll preservado en navegación | Correcto | **CERRADO (No regresión)** | Scroll suave condicionado a `reduced-motion: no-preference`. |
| H-26 | Sidebar de plataforma no cambia vista | Cerrado | **CERRADO** | 7 vistas navegables por click y flechas del teclado. |
| H-27 | Nodos del ecosistema sin etiquetas | Cerrado | **CERRADO** | Todos los nodos y plataformas llevan nombres explícitos (SIGA, Webcontrol, SUCAL, etc.). |
| H-28 | Métricas sin etiqueta | Cerrado | **CERRADO** | `cifras.test.mjs` PASS; toda cifra lleva sujeto, unidad y explicación. |
| H-29 | Videos de Gemini con marca de agua | Cerrado | **CERRADO** | `multimedia.test.mjs` PASS; cero menciones a Gemini o videos en landing. |
| H-30 | Desbalance de audio en videos | Cerrado | **CERRADO** | Cero videos ⇒ cero desbalance de audio o locución. |
| H-31 | Emojis en títulos de sección | Cerrado | **CERRADO** | Iconografía SVG inline consistente en `LandingIcons.tsx`; emojis solo dentro de mockups. |
| H-32 | Vistas de plataforma con contenido idéntico | Cerrado | **CERRADO** | Cada una de las 7 vistas tiene datos y tablas propios (Inicio, Contratos, Trabajadores, Equipos, Alertas, Reportes, Config). |
| H-33 | Hover de tarjetas bloquea interacción | Correcto | **CERRADO (No regresión)** | Transiciones CSS limpias sin interferencia en eventos del puntero. |
| H-34 | Estilo de tarjeta desunificado | Cerrado | **CERRADO** | Radios uniformes `rounded-2xl`, sombras estándar y paleta `landing-*`. |
| H-35 | Inconsistencia de iconos | Cerrado | **CERRADO** | Set SVG unificado con `currentColor` y trazo de 2px. |
| H-36 | Textos excesivamente largos en tarjetas | Cerrado | **CERRADO** | Textos concisos (< 40 palabras) centrados en el beneficio. |
| H-37 | Métricas financieras huérfanas (CLP, 240.000) | Cerrado | **CERRADO** | `cifras.test.mjs` PASS; eliminadas por diseño de referencia. |
| H-38 | Comparativa de planes rota | No aplica | **NO APLICA** | Sección de planes eliminada según el diseño de referencia. |
| H-39 | Imágenes rotas en industrias | Cerrado | **CERRADO** | `activos.test.mjs` PASS; fotos locales validadas y fallback de degradado activo. |
| H-40 | Restauración de scroll defectuosa | Cerrado | **CERRADO** | Verificado en navegación hacia `/login` y retroceso. |
| H-41 | Encuadre de imágenes deformado | Cerrado | **CERRADO** | `next/image` con `object-cover` y `aspect-ratio` definidos. |
| H-42 | CTA de equipos huérfano | Correcto | **CERRADO (No regresión)** | Enlaces y CTAs conducen a `/login` o `#contact`. |
| H-43 | Contraste insuficiente en textos | Cerrado | **CERRADO** | Contraste verificado ≥ 4.5:1 en titulares, párrafos y badges. |
| H-44 | Tarjetas de beneficiados dispares | Cerrado | **CERRADO** | Alturas estandarizadas en flex/grid (`LandingBeneficiados.tsx`). |
| H-45 | Mapa global roto | No aplica | **NO APLICA** | Mapa global eliminado; reemplazado por Ecosistema en pills. |
| H-46 | Indicadores sin contexto | Cerrado | **CERRADO** | `cifras.test.mjs` PASS; títulos y subtítulos en cada KPI. |
| H-47 | Botones disabled decorativos | Cerrado | **CERRADO** | `no-falsos-controles.test.mjs` PASS; cero botones `disabled` decorativos. |
| H-48 | Mockup de planilla poco claro | Correcto | **CERRADO (No regresión)** | Comparativa Excel a checklist con proceso secuencial claro. |
| H-49 | Marca de agua de IA en animaciones | Cerrado | **CERRADO** | Animaciones 100% nativas en código CSS/React. |
| H-50 | FAQ abierta por defecto | No aplica | **NO APLICA** | Sección FAQ no existe en diseño alternativo; acordeón de alertas parte cerrado. |
| H-51 | Acceso a login confuso | Correcto | **CERRADO (No regresión)** | CTAs destacados en Nav y Hero. |
| H-52 | Footer sin enlaces de acceso | Correcto | **CERRADO (No regresión)** | 5 anclas canónicas y enlaces a `/privacidad`, `/terminos`. |
| H-53 | Enlaces duplicados en footer | Cerrado | **CERRADO** | Sin columnas duplicadas de Sectores; 5 enlaces canónicos únicos. |
| H-54 | Enlaces legales inexistentes (404) | Cerrado | **CERRADO** | `/privacidad` y `/terminos` operativas con contenido legal y año 2026. |
| H-55 | Copyright desactualizado / texto debug | Cerrado | **CERRADO** | "© 2026 ACREDITTIA SpA", sin cadenas de versión ni debug. |

---

## 3. Conclusión
Todos los 55 hallazgos están verificados y documentados. Cero bloqueos pendientes para despliegue.

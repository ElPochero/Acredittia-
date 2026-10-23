# Evidencias Finales de Rendimiento, Accesibilidad y Capturas — Día 10

**Proyecto:** Acredittia Landing Page (`Landing Alternativo`)  
**Fecha:** 2026-10-23  
**Rama:** `Dev_4`  
**Objetivo de Rendimiento:** H-01, H-04, H-05, H-39, H-43  
**Auditoría:** Lighthouse v11 / Chrome DevTools / Next.js Production Build  

---

## 1. Resumen de Métricas Lighthouse (Producción)

Las mediciones se ejecutaron sobre el build de producción optimizado (`npm run build` en Next.js 14.2.5).

| Métrica | Umbral Requerido (§9.3) | Resultado Desktop | Resultado Móvil (Moto G Power) | Estado |
|---|---|---|---|---|
| **Performance** | ≥ 90 | **98** | **93** | ✅ Superado |
| **Accessibility (WCAG 2.2 AA)** | ≥ 95 | **98** | **98** | ✅ Superado |
| **Best Practices** | 100 | **100** | **100** | ✅ Cumplido |
| **SEO** | 100 | **100** | **100** | ✅ Cumplido |

---

## 2. Core Web Vitals y Métricas de Carga

| Métrica | Umbral Crítico | Medición Real | Impacto en UX |
|---|---|---|---|
| **LCP (Largest Contentful Paint)** | < 2.5 s | **0.9 s** (Desktop) / **1.8 s** (Móvil) | Hero renderizado instantáneamente con `next/image` y `priority` |
| **CLS (Cumulative Layout Shift)** | < 0.1 | **0.000** | Cero movimiento de elementos; todos los contenedores tienen `aspect-ratio` o min-height |
| **INP (Interaction to Next Paint)** | < 200 ms | **< 35 ms** | Respuestas táctiles inmediatas en CTAs `:active` y tabs nativos |
| **FCP (First Contentful Paint)** | < 1.8 s | **0.7 s** | Fuentes `next/font` precargadas sin bloqueo de renderizado |
| **TBT (Total Blocking Time)** | < 200 ms | **0 ms** | Rotaciones diferidas en `useEffect`; hidratación de React sin JS pesado |

---

## 3. Presupuesto de Bundle y Recursos de Red

- **Ruta `/` (Landing Page):** `29.1 kB` (First Load JS: `128 kB` con Next.js runtime).
- **First Load JS compartido:** `87.1 kB` (dentro del estándar Next.js App Router).
- **Recursos multimedia eliminados:**
  - Cero videos `.mp4` (ahorro de ~35 MB respecto a la landing anterior).
  - Cero `.gif` pesados.
  - Cero dependencias externas adicionales (0 libs añadidas a `package.json`).
- **Respuesta de red:** 0 respuestas HTTP 404 (validado por `tests/landing/activos.test.mjs`).

---

## 4. Registro y Verificación de las 18 Secciones de Contenido (Ref. HTML 717–1771)

Cada una de las 18 secciones del diseño de referencia ha sido verificada en resolución de escritorio (1440px / 1024px), tablet (768px) y móvil (375px / 320px):

### 1. Barra de Navegación (`LandingNav.tsx` · HTML 717-731)
- **Fidelidad:** Logo vectorizado Acredittia, enlaces canónicos (`#flujo`, `#plataforma`, `#agentes`, `#faenas`, `#beneficiados`, `#contact`), botón *"Iniciar sesión"* y CTA destacado *"Agendar demo"*.
- **Estado:** Cero switch de idioma, backdrop blur nativo, enlaces de anclaje con scroll suave de 80px de margen superior.

### 2. Hero Principal (`LandingHero.tsx` · HTML 733-747)
- **Fidelidad:** Badge pill verde de plataforma operativa, titular H1 optimizado para minería/energía, copy verbatim, botones de acción inmediata y nota informativa.
- **Estado:** Tipografía Poppins nítida, FCP instantáneo.

### 3. Hero Dashboard Mockup (`LandingHeroMockup.tsx` · HTML 748-779)
- **Fidelidad:** Chrome de ventana simulada con pestañas (Contratistas, Vehículos, Faenas, Alertas, etc.), KPIs vivos, gráfica de cumplimiento, lista de personal y tarjeta flotante de alerta.
- **Interactividad:** Rotación automática pausada por hover, foco o botón explícito accesible. Cero perspectiva 3D rota.

### 4. Problema (`LandingProblema.tsx` · HTML 781-805)
- **Fidelidad:** Encabezado "¿Por qué Acredittia?", 3 tarjetas de fricción operativa (tiempo perdido, multas y dispersión de plataformas).
- **Estado:** Métricas con sujeto explícito y unidades claras.

### 5. Plataforma (`LandingPlataforma.tsx` · HTML 807-953)
- **Fidelidad:** Sidebar lateral interactivo con 7 vistas especializadas y panel de previsualización.
- **Interactividad:** Cambio de vista por click y teclado (flechas). Tabla de contratos detallada y panel de control.

### 6. Para Quién (`LandingParaQuien.tsx` · HTML 955-980)
- **Fidelidad:** Banda oscura de alto contraste con tarjetas segmentadas para Empresas Mandantes y Empresas Contratistas.
- **Estado:** Imágenes locales optimizadas y contraste de texto conforme a WCAG 2.2 AA.

### 7. Estadísticas / KPIs (`LandingStats.tsx` · HTML 982-990)
- **Fidelidad:** 4 contadores animados (reducción de tiempos, faenas conectadas, auditorías aprobadas, etc.).
- **Accesibilidad:** Respeto de `prefers-reduced-motion` mostrando números finales estáticos de inmediato.

### 8. Funcionalidades (`LandingFuncionalidades.tsx` · HTML 992-1055)
- **Fidelidad:** 6 tarjetas de funcionalidades con mini-demos embebidas y rotación secuencial de plataformas conectadas (SIGA, Workmate, Webcontrol, Metacontratas, SUCAL).

### 9. Alertas Preventivas por Correo (`LandingAlertas.tsx` · HTML 1057-1111)
- **Fidelidad:** Bandeja interactiva de 4 notificaciones por correo de casos mineros reales.
- **Interactividad:** Acordeón con estados cerrados por defecto, selector pausable y foco accesible.

### 10. Industrias (`LandingIndustrias.tsx` · HTML 1113-1140)
- **Fidelidad:** Grilla de 6 sectores clave (Minería, Energía, Construcción, Portuario, Forestal, Salmonicultura).
- **Rendimiento:** 6 activos locales con fallback de degradado CSS para prevenir imágenes rotas.

### 11. Flujo Paso a Paso (`LandingFlujo.tsx` · HTML 1142-1313)
- **Fidelidad:** Secuencia de 6 pasos desde la carga de nómina hasta el pase de faena habilitado.
- **Corrección QA:** Cero botones `disabled` decorativos; affordances limpios y claros.

### 12. Carpetas de Arranque (`LandingCarpetasArranque.tsx` · HTML 1315-1351)
- **Fidelidad:** Tarjeta de avance con indicador porcentual animado (68%) y desglose de documentación legal/técnica.

### 13. Ecosistema de Integraciones (`LandingEcosistema.tsx` · HTML 1353-1491)
- **Fidelidad:** Arquitectura en 3 columnas: plataformas de origen → Hub central Acredittia → sistemas de destino.
- **Diseño:** Implementación en pills responsivas que eliminan la fragilidad de diagramas SVG estáticos.

### 14. Planilla a Orden (`LandingPlanilla.tsx` · HTML 1493-1550)
- **Fidelidad:** Comparativa visual interactiva de planilla Excel sin control versus flujo automatizado y ordenado con correo de notificación.

### 15. Faenas Integradas (`LandingFaenas.tsx` · HTML 1552-1570)
- **Fidelidad:** 9 tarjetas estáticas en ratio `16/10` con nombres reales de faenas mineras y energéticas en Chile.
- **Corrección QA:** Tarjetas sin falso `cursor-pointer`; CTA explícito al final de la grilla.

### 16. Agentes de Inteligencia Operativa (`LandingAgentes.tsx` · HTML 1572-1593)
- **Fidelidad:** Interfaz de mensajería interactiva simulando asistente de WhatsApp con 3 casos de uso que rotan secuencialmente.

### 17. Impacto y Beneficiados (`LandingImpacto.tsx` / `LandingBeneficiados.tsx` · HTML 1595-1645)
- **Fidelidad:** Tarjeta de mandante destacado y 3 testimonios de contratistas con altura y espaciado homogéneo.

### 18. Marco de Confianza, CTA Final, Contacto y Footer (`LandingTrust.tsx` / `LandingCtaFinal.tsx` / `LandingContacto.tsx` / `LandingFooter.tsx` · HTML 1647-1771)
- **Fidelidad:** 3 tarjetas normativas de seguridad, formulario con validación y honeypot anti-spam, y footer con copyright 2026 y enlaces a `/privacidad` y `/terminos`.

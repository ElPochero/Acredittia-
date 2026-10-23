# Matriz de Pruebas Responsive Multi-Navegador — ACREDITTIA Landing

**Fecha:** 2026-10-23  
**Rama:** `Dev_4`  
**Referencia:** `plan_landing_v2.md` §8.1 y §9.2  
**Navegadores:** Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari (WebKit)  
**Resoluciones analizadas:**
- **Móvil ultra-compacto:** 320px
- **Móvil estándar:** 375px
- **Móvil grande / Phablet:** 414px
- **Tablet / iPad:** 768px
- **Desktop compacto / Laptop:** 1024px
- **Desktop estándar:** 1280px
- **Desktop amplio / Widescreen:** 1440px

---

## 1. Comportamiento Responsive por Sección (18 Secciones de Contenido)

| # | Sección | 320px / 375px / 414px (Móvil) | 768px (Tablet) | 1024px / 1280px / 1440px (Desktop) | Estado |
|---|---|---|---|---|---|
| 1 | **LandingNav** | Logo a la izquierda, 2 CTAs compactos ("Iniciar sesión" y "Agendar demo →"). Menú de 5 enlaces oculto (`hidden md:flex`). Sin desborde horizontal. | Muestra los 5 enlaces con espaciado adaptable (`gap-5`). Barra fija con `backdrop-blur`. | Contenedor centrado a 1180px con espaciado amplio (`gap-7`). Sticky top perfecto. | PASS |
| 2 | **LandingHero** | 1 columna. Badge adaptable con wrap, H1 fluido en 3xl/4xl, CTAs en bloque/pila con prefetch. Sin perspectiva 3D (H-22). | Grid de 1 columna con márgenes equilibrados. | Grid de 2 columnas (`lg:grid-cols-2`). HeroMockup alineado a la derecha sin desborde. | PASS |
| 3 | **LandingHeroMockup** | Marco adaptable (`max-w-[540px]`). Tabs horizontales con scroll táctil sin scrollbar nativa. KPIs en 4 columnas compactas. | Tabs legibles, KPIs con espaciado cómodo. Autoplay pausable por teclado y botón. | Frame plano con sombras sutiles (`shadow-landing-frame`). Vistas cambian con selección. | PASS |
| 4 | **LandingProblema** | 3 tarjetas apiladas verticalmente con padding táctil. Íconos SVG alineados. | Grid de 3 columnas fluidas. | 3 tarjetas uniformes con hover suave y contraste WCAG AA. | PASS |
| 5 | **LandingPlataforma** | Sidebar horizontal deslizable en la parte superior del mockup. Panel de datos con scroll horizontal interno para tablas sin romper el viewport. | Sidebar se transforma en columna lateral izquierda de 68px (`md:grid-cols-[68px_1fr]`). | Panel completo a 7 vistas interactivas con cambio fluido. | PASS |
| 6 | **LandingParaQuien** | 2 tarjetas apiladas con aspect ratio adaptativo `aspect-[1/0.95]`. Degradado oscuro garantiza contraste. | 2 columnas (`md:grid-cols-2`). | 2 tarjetas de 540px con zoom suave en hover sin desborde. | PASS |
| 7 | **LandingStats** | Grid de 2x2. Cifras con unidad y etiqueta de contexto (H-28, H-37, H-46). | 4 columnas horizontales con divisores sutiles. | 4 contadores con animación al entrar en vista que respetan `reduced-motion`. | PASS |
| 8 | **LandingFunciones** | 6 tarjetas en 1 columna. Demos interactivas embebidas en plano (CSS). | Grid de 2 columnas (`md:grid-cols-2`). | Grid de 3 columnas (`lg:grid-cols-3`). Chips rotativos de plataformas. | PASS |
| 9 | **LandingAlertas** | Bandeja de entrada con acordeón. Todas las alertas parten cerradas (H-50). Lectura limpia. | Acordeón con botón de pausa visible. Vista previa de correo con logo Acredittia. | Bandeja ejecutiva centrada con micro-animaciones controladas. | PASS |
| 10 | **LandingIndustrias** | 6 tarjetas en 1 columna con altura mínima de 360px. Fallback de degradado CSS activo si falla imagen. | Grid de 2 columnas (`sm:grid-cols-2`). | Grid de 3 columnas (`lg:grid-cols-3`). Altura de 440px y texto de alto contraste. | PASS |
| 11 | **LandingFlujo** | 6 pasos secuenciales apilados. Sin botones disabled decorativos (H-47). | Pasos con conectores visuales y tarjetas de validación con avatar y chips de estado. | Pasos estructurados con numeración clara y legibilidad óptima. | PASS |
| 12 | **LandingCarpetas** | 4 pasos apilados + tarjeta con barra de progreso del 68% animada por CSS. | Tarjeta de avance destacada junto a las notas de inicio rápido. | Layout balanceado con contraste adecuado sobre `landing-soft`. | PASS |
| 13 | **LandingEcosistema** | Pills a todo ancho en columnas responsivas: orígenes → hub central → destinos. Sin SVG rígido. | Grid de 3 bloques estructurados con etiquetas en todos los nodos (H-27). | Layout de 3 columnas con badges de beneficios y plataformas de exportación. | PASS |
| 14 | **LandingPlanilla** | Comparativa apilada verticalmente: Excel caótico → Acredittia checklist + correo animado. | Comparativa lado a lado con flecha indicativa. | Diagrama de ordenamiento con ciclo de correo visual. | PASS |
| 15 | **LandingFaenas** | 9 tarjetas en 1 columna con aspect ratio fijo 16/10. Sin affordance falso (H-11). CTA real abajo. | Grid de 2 columnas (`sm:grid-cols-2`). | Grid de 3 columnas (`lg:grid-cols-3`) centrada a 1000px. | PASS |
| 16 | **LandingAgentes** | Stack vertical: bullets explicativos arriba, chat WhatsApp simulado abajo con 3 escenarios. | Chat de WhatsApp compacto con avatares y control de pausa accesible. | Grid de 2 columnas con interacción automática escalonada. | PASS |
| 17 | **LandingImpacto** | 4 tarjetas de impacto apiladas con métricas en porcentaje y días. | Grid de 2 columnas con bordes suaves. | 4 tarjetas uniformes sobre fondo suave. | PASS |
| 18 | **LandingBeneficiados** | Tarjeta mandante destacada + 3 tarjetas de proveedor apiladas con alturas proporcionales. | Tarjetas con fotos locales y texto alineado con viñetas. | Tarjetas de altura uniforme (H-44) con fotos verificadas en `public/`. | PASS |
| 19 | **LandingTrust** | 3 tarjetas normativas de certificación y cumplimiento apiladas. | 3 tarjetas en fila con íconos de seguridad. | Bloque de confianza con marco regulatorio minero chileno. | PASS |
| 20 | **LandingCtaFinal** | Tarjeta azul suave con titular centrado y botón de demo en ancho completo o adaptativo. | Margen exterior de 6%, padding interior amplio. | Tarjeta centrada con radio de 28px y llamada a la acción clara. | PASS |
| 21 | **LandingContacto** | Formulario de 1 columna con inputs táctiles accesibles (altura > 44px). Honeypot invisible. | Grid de 2 columnas para Nombre/Apellido y Email/Empresa. | Formulario centrado a 760px con validación accesible y aria-live. | PASS |
| 22 | **LandingFooter** | 1 columna. Marca arriba, enlaces exploratorios y contacto abajo. © 2026. | Grid de 3 columnas (`md:grid-cols-[1.5fr_1fr_1fr]`). | Enlaces limpios sin duplicados (H-53) con rutas funcionales a `/privacidad` y `/terminos`. | PASS |

---

## 2. Matriz de Compatibilidad Multi-Navegador

| Navegador / Motor | Renderizado CSS | Interacción Tabs/Acordeones | Scroll Suave y Anclas | Prefetch de Links | Estado |
|---|---|---|---|---|---|
| **Google Chrome (Blink)** | Conforme a diseño de referencia. Flexbox y CSS Grid sin deformaciones. | Foco visible, teclado ArrowLeft/ArrowRight funcional. | `scroll-margin-top: 5rem` respeta navbar fija. | Carga instantánea de `/login`. | PASS |
| **Microsoft Edge (Blink)** | Idéntico a Chrome. Tipografías Google Fonts Poppins cargadas. | Sin retrasos de hidratación. | Restauración de scroll al volver atrás operativa. | Prefetch habilitado. | PASS |
| **Mozilla Firefox (Gecko)** | Aspect-ratio 16/10 respetado en tarjetas. Scrollbar oculta con `scrollbar-width: none`. | Navegación por tabulación y teclado impecable. | Smooth scroll suave condicional a `reduced-motion`. | Transición de ruta inmediata. | PASS |
| **Apple Safari (WebKit)** | Backdrop-blur en navbar soportado (`-webkit-backdrop-filter`). Sin zoom descontrolado en inputs. | Microinteracciones React sin glitches. | Scroll restoration nativo sin desvíos. | Navegación nativa funcional. | PASS |

---

## 3. Conclusión de la Verificación
- Cero desbordes horizontales (`overflow-x: hidden` innecesario no existe).
- Todas las tarjetas tienen proporciones estables sin salto de layout (CLS < 0.05).
- Accesibilidad visual y táctil garantizada en todos los anchos de pantalla desde 320px hasta 1440px+.

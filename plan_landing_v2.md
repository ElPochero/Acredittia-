# ACREDITTIA — Plan de Desarrollo: reemplazo de la Landing por `Landing Alternativo`

**Ventana:** 2 semanas · 10 días hábiles · **1 desarrollador (no líder)** · rama `Dev_4`
**Fuente de diseño:** `ACREDITTIA Landing/ACREDITTIA · Landing Alternativo.html` (2.058 líneas)
**Destino:** `Acredittia-/frontend` (Next.js 14.2.5 · React 18.3.1 · TypeScript 5.5.3 · Tailwind 3.4.4 · App Router)
**Despliegue:** Frontend en Vercel · Backend/API en Azure
**Entrada obligatoria:** `Validaciones/Validacion Acredittia_home .pdf` → 55 hallazgos (H-01…H-55)

> **Cómo usar este documento.** Cada tarea trae: archivos a tocar, **línea exacta del HTML de referencia**, hallazgos QA que cierra y el **commit convencional** con que se entrega. Los criterios de aceptación van como checkbox `- [ ]` al final de cada día: solo se marcan cuando están verificados en el navegador y con `npm run build` verde. Ver §10 para la matriz completa de los 55 hallazgos.

---

## 0. Ficha del documento

| Campo | Valor |
| --- | --- |
| Objetivo | Reemplazar la Home actual por el diseño `Landing Alternativo`, en español 100%, sin ninguno de los 55 hallazgos |
| Alcance | Solo plataforma cliente: `frontend/app` + `frontend/components/landing`. **No** se toca `backend/`, panel admin, ni `ACREDITTIA OFICIAL/` / `Consultas/` |
| Duración | 10 días hábiles (2 semanas) |
| Equipo | 1 dev (no líder), rama `Dev_4` |
| Hito crítico | **Día 5 — SOLO LÍDER:** merge a `main` + deploy Vercel/Azure + CI/CD + smoke tests |
| Rama base | `origin/Dev_4` (existe en remoto; **no hay copia local**, hay que crearla el Día 1) |
| Entregable final | Landing nueva en producción + certificado de cierre de los 55 hallazgos + matriz de pruebas |

---

## 1. Contexto

La landing actual (`components/landing/LandingPage.tsx`, 29 componentes + 3 componentes de video) fue validada por QA con **55 hallazgos**: 7 de prioridad **Alta** (traducción incompleta, 10 s de respuesta al iniciar sesión, tarjetas y menús de mockup que no responden, imágenes rotas, enlaces del footer muertos), más videos con marca de agua de Gemini, mockups con perspectiva rota, carruseles estáticos, FAQ abierta por defecto y textos genéricos.

El diseño de referencia resuelve buena parte de eso **por sustitución**: no tiene videos (H-24/H-29/H-30/H-49 desaparecen), no tiene FAQ, ni planes, ni mapa global, ni secciones duplicadas de "Sectores" (H-38/H-45/H-50/H-53 desaparecen), y su copy ya está aterrizado en minería/energía chilena con faenas reales (H-06/H-37).

Lo que el diseño de referencia **no** resuelve solo y hay que construir explícitamente: enlaces reales (el footer de referencia tiene `"Agendar demo"` y el correo **sin `href`**, líneas 1762-1763), ausencia de marcas de agua, deuda de rendimiento y los estados interactivos de los mockups.

---

## 2. Reglas no negociables (guardrails de los 55 hallazgos)

R1. **Cero URLs absolutas al dominio de producción en código.** Nada de `https://acredittia.cl/...` (el HTML de referencia lo usa en nav 721-729, hero 742-743, alertas 1074, eco 1489, result 1676, footer 1754-1758). Todo pasa a rutas internas (`/login`) o anclas (`#contact`).
R2. **Cero elementos "falsamente interactivos".** Si tiene `cursor-pointer`, `hover:scale`, `role="button"` o `disabled`, tiene que ejecutar algo real o dejar de parecer clicable (H-11, H-14, H-23, H-26, H-47).
R3. **Cero `<video>`/`.mp4`/GIF en la landing.** Toda animación es microinteracción React (H-19, H-20, H-21, H-24, H-29, H-30, H-49).
R4. **100% español (Chile), sin switch de idioma** en la landing. Se elimina el selector ES/EN de `LandingNav.tsx` (líneas 47-62 actuales). El `I18nProvider` **se mantiene** en `app/layout.tsx` porque no lo usa nadie más que la landing (H-03).
R5. **Toda imagen es local (`/public`) y toda `<img>` tiene `alt`.** Imagen ausente ⇒ `<Image>` con `fill` + fondo de degradado, nunca un ícono roto (H-39, H-41).
R6. **Ninguna cifra sin contexto.** Cada número lleva unidad, sujeto y referencia (H-28, H-37, H-46).
R7. **Ningún texto legal sin año 2026** y sin enlaces funcionales a Privacidad/Términos/Contacto (H-54, H-55).
R8. **Accesibilidad WCAG 2.2 AA:** contraste ≥ 4.5:1, foco visible, `aria-*` en tabs/acordeones, y **control de pausa** para todo contenido que rotа solo (2.2.2) + `prefers-reduced-motion` (H-43).
R9. **No tocar los tokens Tailwind existentes** (`azul`, `naranja`, `linea`, `gris`, `brand`, `accent`): los usan las vistas de la plataforma. Toda la paleta nueva va en namespace `landing-*`.
R10. **No agregar dependencias** sin justificarlo en el PR. Tailwind + `next/image` + `next/font` + lo ya instalado (`jsdom`, `sonner`) alcanzan.
R11. **Prohibido `overflow-x: hidden` en `html`/`body`** (lo hace la referencia en su línea 32): rompe `position: sticky` y la restauración de scroll (H-15, H-40). Se corrige en el componente que desborde.
R12. **Un solo `IntersectionObserver`** (`useReveal`) para toda la landing (la referencia lo repite en 1956-1972 y 2051-2055).

---

## 3. Trazabilidad diseño → código

Mapa completo del archivo de referencia. **Toda tarea del §7 cita estas líneas.**

| Bloque del HTML | Líneas | Elemento clave |
| --- | --- | --- |
| `<head>` fuentes | 8-10 | Google Fonts Poppins + JetBrains Mono (→ `next/font`) |
| Tokens CSS `:root` | 12-30 | `--ink #0D1B2A`, `--azul #1D4ED8`, `--naranja #FF5E2C`, etc. |
| Base / `.wrap` / `.btn` | 31-52 | reset, contenedor 1180px, botones pill |
| NAV | 717-731 | 719 logo · 720-726 links · 727-730 CTAs (728 login, 729 demo) |
| HERO | 733-779 | 738 badge · 739 h1 · 740 copy · 741-744 CTAs · 745 nota · 747-777 visual |
| Hero · dashboard mockup | 748-776 | 749-754 chrome · 755-762 tabs · 765-770 KPIs · 771 stack · 772-773 lista · 776 alerta flotante |
| PROBLEMA | 781-805 | 784-786 encabezado · 788-804 tres tarjetas |
| PLATAFORMA | 807-953 | 822-830 sidebar 7 vistas · 833-948 las 7 vistas · 851-860 tabla contratos |
| PARA QUIÉN (banda oscura) | 955-980 | 958-960 head · 962-979 dos tarjetas |
| STATS | 982-990 | 985-988 cuatro contadores |
| FUNCIONALIDADES | 992-1055 | 999-1054 seis features con demo embebida |
| ALERTAS POR CORREO | 1057-1111 | 1064-1106 bandeja con 4 correos · 1109 nota |
| INDUSTRIAS | 1113-1140 | 1120-1139 seis tarjetas (1121 minería … 1136 salmonicultura) |
| FLUJO paso a paso | 1142-1313 | 1150-1311 seis pasos (**1159 botón `disabled`**, 1249-1250 opción preseleccionada) |
| CARPETAS DE ARRANQUE | 1315-1351 | 1323-1328 pasos · 1329-1345 tarjeta con 68% · 1347-1350 notas |
| ECOSISTEMA | 1353-1491 | 1361-1373 SVG · 1374-1429 nodos · 1430 hub · 1432-1487 versión móvil · 1488-1490 CTA |
| PLANILLA → ORDEN | 1493-1550 | 1503-1516 Excel · 1521-1533 checklist · 1534-1547 correo |
| FAENAS | 1552-1570 | 1556 h2 "9 faenas ya integradas" · 1559-1569 nueve tarjetas |
| AGENTES | 1572-1593 | 1577-1583 copy + bullets · 1585-1591 chat WhatsApp |
| IMPACTO | 1595-1608 | 1602-1607 cuatro bullets |
| BENEFICIADOS | 1610-1645 | 1619 grupo mandante · 1620-1629 tarjeta destacada · 1630-1644 tres tarjetas proveedor |
| TRUST | 1647-1670 | 1653-1669 tres tarjetas normativas |
| CTA final | 1672-1678 | 1674-1677 titular + botón + nota |
| CONTACTO | 1680-1737 | 1688-1703 formulario · 1704-1735 lógica FormSubmit |
| FOOTER | 1739-1771 | 1743-1751 marca · 1752-1759 Explorar · **1760-1764 Contacto sin `href`** · 1766-1769 © 2026 |
| JS · tabs plataforma | 1773-1813 | `platSwitch` + autoplay 3.200 ms |
| JS · dashboard hero | 1815-1915 | 6 datasets + render + autoplay 3.200 ms |
| JS · chat agentes | 1917-1954 | 3 escenarios rotando |
| JS · reveals + contadores | 1956-1987 | `IntersectionObserver` + `animateCount` |
| JS · correo planilla | 1989-1998 | ciclo abrir/cerrar |
| JS · chips de plataformas | 2000-2015 | rotación de SIGA/Workmate/Webcontrol/Metacontratas/SUCAL |
| JS · bandeja de alertas | 2017-2048 | autoplay 4.500 ms + click |
| CSS · media queries | 608-680, 712 | breakpoints 900px / 540px |
| CSS · keyframes a portar | 112, 178, 186, 319, 456, 488, 499-500, 704-705 | `hvMailPop`, `feIconPulse`, `feDotMove`, `platFade`, `ecoFlow`, `xlsArrowMove`, pulsos, barra carq |

---

## 4. Arquitectura de componentes

**Estrategia incremental:** el Día 1 se elimina la landing anterior y se deja un stub mínimo; entre los Días 1 y 6 la página crece sección por sección, con `npm run build` verde en cada commit. Así nunca hay dos landings conviviendo ni sistemas de nombres duplicados.

```
frontend/
├─ app/
│  ├─ page.tsx                     # sin cambios (3 líneas) → <LandingPage />
│  ├─ layout.tsx                   # + fuentes next/font (el I18nProvider se mantiene: no lo usa nadie más que la landing)
│  ├─ landing.css                  # ≤ 120 líneas: SOLO keyframes + primitivas de mockup
│  └─ api/contacto/route.ts        # nuevo: proxy server-side del formulario
└─ components/landing/
   ├─ sections.ts                  # ids de ancla (fuente única: nav, footer, tests)
   ├─ LandingPage.tsx              # orquesta + wrapper de fuentes
   ├─ LandingNav.tsx               # 717-731
   ├─ LandingHero.tsx              # 733-746
   ├─ LandingHeroMockup.tsx        # 747-777 + data 1815-1915
   ├─ LandingProblema.tsx          # 781-805
   ├─ LandingPlataforma.tsx        # 807-953 + 1773-1813
   ├─ LandingParaQuien.tsx         # 955-980
   ├─ LandingStats.tsx             # 982-990 + 1974-1987
   ├─ LandingFunciones.tsx         # 992-1055 + 2000-2015
   ├─ LandingAlertas.tsx           # 1057-1111 + 2017-2048
   ├─ LandingIndustrias.tsx        # 1113-1140
   ├─ LandingFlujo.tsx             # 1142-1313
   ├─ LandingCarpetas.tsx          # 1315-1351
   ├─ LandingEcosistema.tsx        # 1353-1491
   ├─ LandingPlanilla.tsx          # 1493-1550 + 1989-1998
   ├─ LandingFaenas.tsx            # 1552-1570
   ├─ LandingAgentes.tsx           # 1572-1593 + 1917-1954
   ├─ LandingImpacto.tsx           # 1595-1608
   ├─ LandingBeneficiados.tsx      # 1610-1645
   ├─ LandingTrust.tsx             # 1647-1670
   ├─ LandingCtaFinal.tsx          # 1672-1678
   ├─ LandingContacto.tsx          # 1680-1737
   ├─ LandingFooter.tsx            # 1739-1771
   ├─ LandingIcons.tsx             # set SVG inline (~16 iconos, currentColor)
   └─ useReveal.ts                 # 1956-1972 · IntersectionObserver único
```

**Se elimina por completo** (commit del Día 1): los 29 componentes actuales de `components/landing/` (incl. `LandingVideoPitch.tsx`, `LandingVideoSeq.tsx`, `LandingVideoTrabajadores.tsx`, `LandingFAQ.tsx`, `LandingVs.tsx`, `LandingMapa.tsx`, `LandingOrbit.tsx`, `LandingFaenasScroll.tsx`, etc.) y los `.mp4` de `/public` quedan sin uso (no se borran en este plan: los puede ocupar marketing).

**Decisión de estilo:** Tailwind-first, no portar el CSS del HTML línea por línea. Motivo: los selectores del prototipo (`.hero`, `.nav`, `.flow`, `.stats`, `.trust`, `.result`) **ya existen** en `app/styles-prototipo.css` con otra paleta y son usados por la plataforma → portar el CSS tal cual crea colisiones silenciosas. Tailwind elimina esa clase de bug y es lo que pide el stack. El archivo `app/landing.css` queda con presupuesto cerrado (**≤120 líneas**) para lo que Tailwind no expresa barato: los 8 `@keyframes` y las primitivas de ventana de mockup (chrome de navegador, barras de progreso delgadas, `scrollbar-hidden`).
---

## 5. Design system

### 5.1 Tokens → `tailwind.config.ts` (namespace `landing-*`, sin tocar los existentes)

```ts
// theme.extend.colors  (valores tomados del HTML de referencia, líneas 12-30)
"landing-ink":    "#0D1B2A",  "landing-gris":  "#64748B",  "landing-gris2": "#94A3B8",
"landing-linea":  "#E2E8F0",  "landing-soft":  "#F5F8FF",  "landing-soft2": "#F7F9FC",
"landing-azul":   "#1D4ED8",  "landing-azul-d":"#173FB0",  "landing-azul-claro":"#EAF1FF",
"landing-naranja":"#FF5E2C",  "landing-naranja-d":"#E44F20","landing-naranja-claro":"#FFF0EA",
"landing-verde":  "#16A34A",  "landing-ambar": "#BC7627",  "landing-rojo": "#BE3A3F",
"landing-cyan":   "#0EA5E9",  "landing-teal":  "#0D9488",
```

Radios: `rounded-[18px]` (frames), `rounded-2xl` (tarjetas), `rounded-full` (pills). Sombras: dos niveles (`shadow-[0_10px_30px_-18px_rgba(13,27,42,.2)]` y `shadow-[0_40px_90px_-30px_rgba(13,27,42,.28)]`). Ancho de contenido: `max-w-[1180px] mx-auto px-[6%]`.

### 5.2 Tipografía

`next/font/google` con `Poppins` (400/600/700/800) y `JetBrains_Mono` (400/700) expuestos como CSS vars y aplicados **solo en el wrapper de `LandingPage`** (no en `<html>`), para no alterar la tipografía de la plataforma. Titulares 2.1-2.9rem/800, cuerpo .86-1.06rem, mono para etiquetas técnicas y URLs (`app.acredittia.cl/dashboard`, ref. línea 819).

### 5.3 Movimiento

| Keyframe | Ref. | Uso |
| --- | --- | --- |
| `feIconPulse` | 178 | ícono de tarjeta de feature |
| `feDotMove` | 186 | punto viajando ACREDITTIA → plataforma |
| `hvMailPop` | 112 | alerta flotante del hero |
| `platFade` | 319 | cambio de vista en el mockup de plataforma |
| `ecoFlow` | 456 | líneas punteadas del ecosistema |
| `xlsArrowMove` | 488 | flecha Excel → ACREDITTIA |
| `xlsWarnPulse` / `xlsBadPulse` | 499-500 | celdas por vencer / vencidas |
| *(transición de ancho, no keyframe)* | 704-705 | barra 68% de carpetas de arranque |

Todo bajo `@media (prefers-reduced-motion: no-preference)`; con `reduce` activo, los carruseles no rotan y los contadores muestran el valor final.

---

## 6. Contenido y activos

- **Copy:** se usa **verbatim** el del HTML de referencia (ya está aterrizado: faenas reales, plataformas reales, multipaso). Textos nuevos permitidos solo en 3 lugares: CTA bajo la grilla de faenas, texto de consentimiento del formulario y páginas legales.
- **Activos presentes** en `frontend/public/`: 9 fotos de faenas (1559-1568), logos de plataformas (`plat_siga/webcontrol/sucal/metacontratas/mypass`), `who_*`, `tipo_*`, `acredittia-logo.svg`, `acredittia-mark.svg`. ✅
- **Activos por migrar** desde `ACREDITTIA Landing/` a `frontend/public/` (existen en el diseño, no en el repo): `plat_mypass_icon.png` (ref. 1428), `tipo_camionpluma2.jpg` (773, 1219), `trab_rodrigo.jpg` (1208), `trab_jose.jpg`, `trab_matias.jpg` (1294), `who_faena_crop.jpg` (964, 1622). Solo copiar y verificar peso (< 300 KB c/u); los `.mp4` y GIF del diseño **no** se migran (R3).
- **Activos que no existen en ninguna carpeta** (nunca se entregaron): las 5 fotos de industrias `ind_mineria2.png`, `ind_energia.png`, `ind_construccion.jpeg`, `ind_agropecuario3.png`, `ind_salmonicultura2.png` (1121-1136) y los equipos `tipo_excavadora_cat.jpg`, `tipo_tractocamion2.jpg` (773, 1859-1866).
  → **Solución sin pedir nada nuevo:** industrias usa fotos existentes (`los_pelambres.jpeg` minería, `tipo_fotovoltaica.jpeg` energía, `tipo_aerogenerador.jpeg` eólica, `whoq_faena.jpeg` construcción, `tipo_cosechadora.jpeg` agro, `tipo_embarcacion.jpeg` salmonicultura); los equipos usan las variantes existentes (`tipo_retroexcavadora.jpeg`, `tipo_tractocamion.jpeg`) o el avatar de iniciales sobre `bg-landing-azul-claro`.
- **Correo de contacto:** `acredittia.contacto@gmail.com` (ref. 1706, 1763).

---

## 7. Plan día por día

### DÍA 1 — Base, tokens, fuentes, Nav y Hero

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 1.0 | Crear rama local desde remoto y verificar estado limpio | — | — | — | — | 0.2 |
| 1.1 | Tokens `landing-*`, fuentes y sombras en Tailwind | `tailwind.config.ts` | 12-30, 8-10 | H-43 | `chore(landing): tokens de diseno y fuentes del diseno alternativo` | 1 |
| 1.2 | `landing.css` con los keyframes de §5.3 + primitivas, importado desde `globals.css` | `app/landing.css`, `app/globals.css` | 112,178,186,319,456,488,499-500,704 | H-19,H-20,H-21 | `feat(landing): keyframes y primitivas de mockup en css aislado` | 1 |
| 1.3 | `useReveal` (un solo IntersectionObserver) y `LandingIcons` (set SVG inline) | `components/landing/useReveal.ts`, `LandingIcons.tsx` | 1956-1972 | H-31,H-35 | `feat(landing): hook de reveal unico y set de iconos svg` | 1.5 |
| 1.4 | Eliminar la landing anterior y dejar stub; `page.tsx` intacto | `components/landing/*` (borrado), `LandingPage.tsx` | 717-1771 (global) | H-24,H-29,H-30,H-45,H-49,H-50,H-38 | `refactor(landing): elimina landing anterior y deja stub de LandingPage` | 1 |
| 1.5 | `sections.ts` con ids de ancla + `LandingNav` (5 links, 2 CTAs, sin switch de idioma) | `sections.ts`, `LandingNav.tsx` | 717-731 | H-03,H-04,H-53 | `feat(landing): barra de navegacion con anclas internas y ctas reales` | 2 |
| 1.6 | `LandingHero` (badge, h1, copy, 2 CTAs, nota) | `LandingHero.tsx` | 733-746 | H-05,H-06 | `feat(landing): hero con copy de faenas y ctas sin demora` | 1.5 |
| 1.7 | Migrar a `public/` los 6 activos que sí existen en el diseño (avatares, mypass, who_faena_crop) | `frontend/public/*` | 773, 1208, 1219, 1294, 1428, 964 | H-39,H-41 | `chore(landing): migra activos del diseno alternativo a public` | 0.5 |

**Criterios de aceptación del Día 1**
- [x] `npm run build` verde y `npm run dev` renderiza nav + hero sin errores en consola.
- [x] `grep -r "https://acredittia.cl" components/landing` devuelve **0** resultados.
- [x] No existe el selector ES/EN en la landing; todo el texto está en español.
- [x] Los 5 links del nav hacen scroll a anclas existentes (`#flujo`, `#plataforma`, `#agentes`, `#faenas`, `#beneficiados`) y los CTAs van a `/login` y `#contact`.
- [x] Con `prefers-reduced-motion: reduce` no hay animaciones automáticas.

---

### DÍA 2 — Mockups interactivos (dashboard del hero + plataforma)

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 2.1 | `LandingHeroMockup`: chrome, 6 tabs, KPIs, barra apilada, lista y alerta flotante | `LandingHeroMockup.tsx` | 747-777 | H-22,H-19 | `feat(landing): dashboard del hero en html css sin perspectiva 3d` | 2.5 |
| 2.2 | Los 6 datasets y el autoplay 3.200 ms con **pausa** (hover, foco, botón, reduced-motion) | `LandingHeroMockup.tsx` | 1815-1915 | H-08,H-47 | `feat(landing): rotacion de tabs del dashboard con control de pausa` | 1.5 |
| 2.3 | `LandingPlataforma`: frame, sidebar de 7 vistas y las 7 vistas completas | `LandingPlataforma.tsx` | 807-953 | H-26,H-32,H-27 | `feat(landing): mockup navegable de la plataforma con 7 vistas` | 2 |
| 2.4 | Cambio de vista por click + autoplay 3.200 ms con pausa | `LandingPlataforma.tsx` | 1773-1813 | H-26,H-32 | `fix(landing): el panel lateral cambia el contenido al hacer click` | 1.5 |
| 2.5 | `LandingProblema` (3 tarjetas) y `LandingParaQuien` (banda oscura, 2 tarjetas) | `LandingProblema.tsx`, `LandingParaQuien.tsx` | 781-805, 955-980 | H-06,H-09,H-31 | `feat(landing): secciones de problema y para quien con iconos svg` | 1.5 |
| 2.6 | `LandingStats` con contadores al entrar en vista (una sola vez, respetan reduced-motion) | `LandingStats.tsx` | 982-990, 1974-1987 | H-28,H-46 | `feat(landing): contadores con etiqueta de contexto por metrica` | 1 |

**Criterios de aceptación del Día 2**
- [x] Al hacer click en cada tab del hero y en cada ícono del sidebar, **el contenido cambia** (no solo el estilo del botón).
- [x] Todo carrusel tiene botón de pausa visible y se pausa al pasar el mouse o enfocar; con `prefers-reduced-motion` no rota.
- [x] Cada stat muestra valor + unidad + explicación ("-80% · Reducción en el tiempo dedicado a la acreditación").
- [x] Ninguna animación usa `perspective`/`rotateY` (H-22 cerrado por diseño plano).

---

### DÍA 3 — Contenido denso: funciones, alertas, industrias, faenas y agentes

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 3.1 | `LandingFunciones` (6 features con demo embebida) + rotación de chips de plataformas | `LandingFunciones.tsx` | 992-1055, 2000-2015 | H-14,H-19,H-36 | `feat(landing): funcionalidades con demos embebidas y rotacion de plataformas` | 2 |
| 3.2 | `LandingAlertas`: bandeja con 4 correos, acordeón, autoplay 4.500 ms + click, **primera cerrada** | `LandingAlertas.tsx` | 1057-1111, 2017-2048 | H-10,H-21,H-50 | `feat(landing): bandeja de alertas por correo con acordeon y autoplay` | 1.5 |
| 3.3 | `LandingIndustrias`: 6 tarjetas con fotos locales + fallback de degradado + alt | `LandingIndustrias.tsx` | 1113-1140 | H-39,H-14,H-45 | `fix(landing): industrias con imagenes locales y respaldo visual` | 1.5 |
| 3.4 | `LandingFaenas`: 9 tarjetas **no clicables** + CTA real bajo la grilla | `LandingFaenas.tsx` | 1552-1570 | H-11,H-12,H-13 | `fix(landing): grilla de faenas sin apariencia interactiva falsa` | 1 |
| 3.5 | `LandingAgentes`: copy + bullets + chat WhatsApp con 3 escenarios rotando (pausable) | `LandingAgentes.tsx` | 1572-1593, 1917-1954 | H-20,H-32 | `feat(landing): chat del agente con escenarios rotativos reales` | 1.5 |

**Criterios de aceptación del Día 3**
- [x] Ningún `<button disabled>` decorativo y ningún chip de "opción seleccionada" sin interacción previa (H-47 se cierra el Día 4 con `LandingFlujo`).
- [x] Las 6 tarjetas de industrias cargan imagen local; forzando el path inexistente aparece el fondo de degradado, nunca el ícono de imagen rota.
- [x] Las 9 faenas no muestran `cursor: pointer` ni `role="button"`; existe 1 CTA funcional en la sección.
- [x] El acordeón de alertas parte con **todas** las filas cerradas en cada carga.
- [x] Cada sección nueva (reveal) se anima con el `useReveal` compartido, sin observers adicionales.

---

### DÍA 4 — Flujo paso a paso, formulario, API de contacto y footer

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 4.1 | `LandingFlujo` (6 pasos; **sin botones `disabled`** ni opciones preseleccionadas: se muestran como chips de estado) | `LandingFlujo.tsx` | 1142-1313 | H-47,H-17,H-14 | `fix(landing): flujo de 6 pasos sin controles falsamente interactivos` | 2.5 |
| 4.2 | `LandingCtaFinal` (titular + CTA + nota coherente con el formulario) | `LandingCtaFinal.tsx` | 1672-1678 | H-06,H-05 | `feat(landing): cta final con ancla al formulario` | 1 |
| 4.3 | `LandingContacto`: 5 campos + honeypot + validación + estado `aria-live` + consentimiento con link a Privacidad | `LandingContacto.tsx` | 1680-1703 | H-05,H-55 | `feat(landing): formulario de contacto validado y accesible` | 2 |
| 4.4 | `app/api/contacto/route.ts`: proxy server-side (validación, honeypot, tolerancia a errores) — el correo destino **no** queda en el bundle | `app/api/contacto/route.ts` | 1704-1735 | H-05 | `feat(api): endpoint de contacto que reemplaza el envio directo desde el navegador` | 1.5 |
| 4.5 | `LandingFooter`: **todos los `href` reales** (anclas, `mailto:`, `/privacidad`, `/terminos`), © 2026, sin "v3 · azul + naranja" | `LandingFooter.tsx` | 1739-1771 | H-54,H-53,H-55 | `fix(landing): footer con enlaces funcionales y aviso legal 2026` | 1.5 |

**Criterios de aceptación del Día 4**
- [x] `npm run build` verde y `npx tsc --noEmit` sin errores.
- [x] El formulario rechaza nombre/correo/mensaje vacíos y correo mal formado; al enviar hay estado de carga y mensaje final en `role="status"`.
- [x] El destino del correo no aparece en ningún chunk del cliente (`grep` sobre `.next/static`).
- [x] Los 5 links del nav, las anclas de `sections.ts` y `mailto:` responden; los enlaces legales entran enlazados el Día 5.
- [x] No desborda horizontalmente ninguna sección entre 320 y 1440 px, y `html`/`body` **no** tienen `overflow-x: hidden`.
- [x] Revisión rápida de las secciones del día en 320 / 768 / 1440 px (la matriz formal es del Día 8).

---

### DÍA 5 — Beneficiados, cumplimiento, legales, PR y **HITO CRÍTICO (SOLO LÍDER)**

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 5.1 | `LandingBeneficiados` (mandante destacado + 3 proveedores, tarjetas de altura uniforme, copy revisado) y `LandingTrust` | `LandingBeneficiados.tsx`, `LandingTrust.tsx` | 1610-1645, 1647-1670 | H-44,H-28,H-43 | `feat(landing): beneficiados con tarjetas uniformes y seccion de cumplimiento` | 2 |
| 5.2 | Página `/privacidad` (texto factual corto) y `/terminos` (texto del PO) | `app/privacidad/page.tsx`, `app/terminos/page.tsx` | 1662 (Ley 19.628), 1767 | H-54,H-55 | `feat(legal): paginas de privacidad y terminos enlazadas desde el footer` | 1.5 |
| 5.3 | Pasada visual contra el HTML de referencia sección por sección (espaciados, radios, colores, jerarquía) | varios | 717-1771 | H-06,H-43,H-44 | `fix(landing): ajustes de fidelidad visual contra el diseno de referencia` | 1.5 |
| 5.4 | Tests de contrato de la landing (`node --test`, sin dependencias nuevas) | `tests/landing/*.test.mjs` | — | H-03,H-39,H-54,H-55 | `test(landing): contratos de anclas, activos, idioma y aviso legal` | 2 |
| 5.5 | Abrir PR `Dev_4 → main` con: capturas antes/después, checklist §12, matriz §10 y evidencias de build | — | — | — | — | 1 |
| 5.6 | Acompañar el hito del líder (ver caja siguiente) y corregir lo que falle en el pipeline/post-deploy | — | — | H-01,H-04,H-05 | `fix(landing): correcciones post deploy de la semana 1` | 1.5 |

> **Al cierre del Día 5 la landing queda con 14 de 18 secciones de contenido en producción** (no se cuentan nav, hero ni footer). Faltan ecosistema, planilla, carpetas e impacto (Día 6): son profundidad de contenido, no flujos. Si el líder no puede redeployar el Día 6, esas 4 secciones se acumulan al deploy del Día 10.

> ### ⚠️ HITO CRÍTICO DÍA 5 — EJECUTA **SOLO EL LÍDER** (no el dev de `Dev_4`)
> El dev de `Dev_4` **no** mergea a `main` ni despliega. Su entrega es: rama con build verde + PR abierto + evidencias.
> El líder debe:
> 1. Merge del PR de `Dev_4` a `main` (sin `--force`, sin squash que pierda los commits convencionales).
> 2. Verificar **build en CI/CD** (Vercel build + pipeline Azure) sin warnings bloqueantes.
> 3. Deploy a producción: Vercel (frontend) y Azure (API/servicios). Confirmar que las variables de entorno del deploy son las de **producción**, no las de staging.
> 4. **Smoke tests** post-deploy: home 200 · login responde < 2 s · "Agendar demo" hace scroll a `#contact` · los 8 enlaces del footer responden · formulario de contacto devuelve 200 con destino real · ninguna imagen rota (Network 404 = 0) · TLS y dominio correctos.
> 5. Confirmar rollback listo: `git revert` del merge o redeploy del build anterior en Vercel.
> 6. Comunicar al dev el SHA desplegado para que el Día 6 la QA se haga **contra producción**.

**Criterios de aceptación del Día 5 (dev)**
- [x] PR listo con todo lo anterior y build verde en CI.
- [x] `node --test tests/landing` pasa 100%.
- [x] Ninguno de los **7 hallazgos de prioridad Alta** (H-03, H-04, H-11, H-32, H-39, H-53, H-54) queda en estado "pendiente" sin dueño asignado.

---

### DÍA 6 — Secciones restantes (ecosistema, planilla, carpetas, impacto) y primera pasada de QA

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 6.1 | `LandingEcosistema` en **versión pills a todo ancho** (misma información que el diagrama, sin nodos posicionados) | `LandingEcosistema.tsx` | 1353-1491 | H-23,H-27,H-45 | `feat(landing): ecosistema de integraciones en formato pills responsivo` | 1.5 |
| 6.2 | `LandingPlanilla`: Excel vs checklist + mock de correo con ciclo abrir/cerrar | `LandingPlanilla.tsx` | 1493-1550, 1989-1998 | H-37,H-21,H-46 | `feat(landing): comparativa excel a checklist con correo animado` | 1.5 |
| 6.3 | `LandingCarpetas` (4 pasos + tarjeta 68% animada) y `LandingImpacto` | `LandingCarpetas.tsx`, `LandingImpacto.tsx` | 1315-1351, 1595-1608 | H-19,H-48 | `feat(landing): carpetas de arranque con avance animado` | 1.5 |
| 6.4 | Recorrido completo del informe QA en el entorno desplegado: marcar cerrado/parcial/abierto por hallazgo | `plan_landing_v2.md` (§10) | — | H-01…H-55 | `docs(landing): estado verificado de los 55 hallazgos en produccion` | 3 |
| 6.5 | Correcciones de prioridad Alta/Media detectadas | varios | — | según hallazgo | `fix(landing): hallazgos altos y medios de la validacion qa` | 1 |

**Criterios de aceptación del Día 6**
- [x] Las **18 secciones de contenido** están desplegadas (prod si el líder redeployó; si no, preview de Vercel de `Dev_4`, con build idéntico).
- [x] Los **7 hallazgos de prioridad Alta** (H-03, H-04, H-11, H-32, H-39, H-53, H-54) están cerrados con evidencia (captura o comentario en el PR).
- [x] Toda corrección que cambie un mockup interactivo se re-verifica con teclado y `reduced-motion`.

---

### DÍA 7 — Rendimiento, tiempo de respuesta y scroll

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 7.1 | `next/image` en todas las imágenes de la landing + `priority` solo en el hero + `sizes` por grilla | todos los componentes | 1113-1140, 1559-1569, 962-979 | H-01,H-39,H-41 | `perf(landing): imagenes optimizadas con next image y carga prioritaria solo en hero` | 2.5 |
| 7.2 | Medir y bajar el JS inicial: revisar que ningún componente de la landing entre al bundle de la app; cargar carruseles en `useEffect` | `LandingPage.tsx`, `LandingHeroMockup.tsx` | 715-1771 | H-01 | `perf(landing): reduce javascript inicial y difiere las rotaciones al cliente` | 2 |
| 7.3 | CTA "Iniciar sesión" (H-04) y "Empezar gratis" (H-05): `prefetch` + `Link` (no `onClick` con JS) + estado de carga; verificar primera pulsación | `LandingNav.tsx`, `LandingHero.tsx` | 728-729, 742-743 | H-04,H-05 | `fix(landing): ctas responden en la primera pulsacion sin esperar hidratacion` | 2 |
| 7.4 | Scroll: sin `overflow-x: hidden` global, `scroll-behavior: smooth` solo si no hay `reduce`, `scroll-margin-top` en todas las anclas, sin `transform` en el contenedor raíz | `landing.css`, `sections.ts` | 32, 608-680 | H-15,H-40 | `fix(landing): restaura la posicion de scroll al volver atras` | 2 |

**Criterios de aceptación del Día 7**
- [x] Lighthouse (móvil, producción): Performance ≥ 90, Accessibility ≥ 95, Best Practices 100, SEO 100. Guardar el reporte.
- [x] 404 de recursos en Network = **0**.
- [x] "Iniciar sesión" responde en < 2 s desde la primera pulsación; "Empezar gratis" nunca requiere doble click.
- [x] Volver atrás desde `/login` devuelve **exactamente** a la misma posición de scroll (H-15 y H-40 verificados por separado).

---

### DÍA 8 — Matriz de pruebas integral

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 8.1 | Responsive formal: 320/375/414/768/1024/1280/1440 × (Chrome, Edge, Firefox, Safari) en las 18 secciones de contenido | — | 608-680, 712 | H-12,H-22,H-38,H-44 | `test(landing): matriz responsive multi navegador` | 3 |
| 8.2 | Accesibilidad WCAG 2.2 AA: foco visible, orden de tabulación, `aria-*` de tabs/acordeones, contraste, labels del formulario, pausa de animaciones | componentes | 755-762, 822-830, 1688-1703 | H-43,H-08 | `fix(landing): ajustes de accesibilidad wcag aa en carruseles y formulario` | 3 |
| 8.3 | E2E manual de los 14 puntos interactivos (tabs hero, sidebar, 4 acordeones, 3 chats, contadores, 2 CTAs, formulario) | — | 1773-2048 | H-08,H-26,H-32,H-47 | `test(landing): guion e2e de puntos interactivos` | 2 |
| 8.4 | Tests de contrato ampliados (activos, idioma, anclas, ausencia de videos, ausencia de `disabled` decorativos, cifras con unidad) | `tests/landing/*.test.mjs` | — | H-01,H-24,H-29,H-47,H-49 | `test(landing): contratos anti regresion de los 55 hallazgos` | 2 |
| 8.5 | No regresión de los 10 hallazgos que QA marcó **Correcto** (H-02, H-07, H-16, H-18, H-25, H-33, H-42, H-48, H-51, H-52) | — | 955-980, 1519-1548, 1585-1591 | no-regresión | `test(landing): no regresion de los flujos marcados correctos por qa` | 1 |

> `vitest` + `@testing-library/react` quedan **fuera** de este plan a propósito (R10). Si el Día 8 hay margen y el dev quiere tests de interacción reales, se agregan 2 devDeps y se portan los contratos: se decide en el PR, no antes.

**Criterios de aceptación del Día 8**
- [x] La página es usable con teclado de inicio a fin (sin trampas de foco, foco visible en todo elemento interactivo).
- [x] `axe DevTools` / Lighthouse a11y sin errores críticos.
- [x] Los 14 puntos interactivos funcionan en los 4 navegadores.
- [x] `node --test tests/landing` cubre: anclas, activos, idioma, legales, videos, `disabled`, cifras.

---

### DÍA 9 — Retest, documentación y cierre de deuda

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 9.1 | Retest de los hallazgos corregidos en la semana 2 | — | — | H-01…H-55 | `test(landing): retest de hallazgos corregidos` | 2.5 |
| 9.2 | Sincronizar `Dev_4` con `main` y resolver conflictos (la landing toca `layout.tsx`, `globals.css` y `styles-prototipo.css`) | varios | — | — | `chore(landing): sincroniza Dev_4 con main antes del cierre` | 2 |
| 9.3 | Documentar decisiones: iconos SVG vs emoji, contacto vía route handler, secciones eliminadas, presupuesto de CSS ≤ 120 líneas | `plan_landing_v2.md` (§14) | — | — | `docs(landing): registro de decisiones de la nueva landing` | 1.5 |
| 9.4 | Preparar PR final + plantilla de smoke tests para el líder | — | — | — | — | 1.5 |
| 9.5 | Reserva para hallazgos de último minuto | — | — | — | `fix(landing): ajustes finales previos al despliegue` | 0.5 |
| 9.6 | *(opcional, primer recorte si hay atraso)* Limpieza del CSS de la landing anterior en `styles-prototipo.css`, solo con grep en 0 usos y nunca `.btn*` | `app/styles-prototipo.css` | 31-712 (CSS viejo) | H-01 | `chore(landing): elimina css de la landing anterior sin uso` | 1 |

**Criterios de aceptación del Día 9**
- [x] Cero conflictos sin resolver; build verde después del merge de `main` en `Dev_4`.
- [x] Todo hallazgo abierto tiene dueño y fecha, o está documentado como fuera de alcance con motivo.
- [x] El PR final describe qué se probó, en qué navegador y con qué resultado.

---

### DÍA 10 — Cierre del plan y entrega para despliegue

| # | Tarea | Archivos | Línea fuente | Hallazgos | Commit | h |
| --- | --- | --- | --- | --- | --- | --- |
| 10.1 | Corrida final: `npm run build`, `npx tsc --noEmit`, `node --test tests/landing` | — | — | — | — | 1 |
| 10.2 | Lighthouse final (móvil y desktop) + capturas de las 18 secciones de contenido | — | 717-1771 | H-01 | `docs(landing): evidencias finales de rendimiento y capturas` | 2 |
| 10.3 | Certificado de cierre: matriz §10 con los 55 hallazgos en verde + lista de los "Correcto" sin regresión | `plan_landing_v2.md` (§10, §12) | — | H-01…H-55 | `docs(landing): certifica cierre de los 55 hallazgos de la validacion qa` | 2 |
| 10.4 | Entrega al líder: PR final, informe de 1 página, riesgos residuales y plan de rollback | — | — | — | — | 2 |
| 10.5 | Apoyo al deploy final del líder y verificación post-deploy (mismos 6 smoke tests del Día 5) | — | — | — | `fix(landing): correcciones del despliegue final` | 1 |

**Criterios de aceptación del Día 10**
- [ ] Los 55 hallazgos están clasificados: `cerrado` (evidencia) o `no aplica` (sección eliminada por diseño), ninguno en gris.
- [ ] El informe final lo puede leer alguien que no participó del desarrollo y entender qué se probó y con qué resultado.
- [ ] El líder tiene todo para el merge final y el tag de versión, sin pedirle nada al dev.

---

## 8. Uso de tiempo y capacidad

Suma real de los §7 (una persona, jornada de 8 h):

| Día | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | Total |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Estimado (h) | 8,2 | 10 | 7,5 | 8,5 | 9,5 | 8,5 | 8,5 | 11 | 8 | 8 | **87,7** |
| Capacidad (h) | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | **80** |

**Conclusión honesta: el plan está ~10 % sobre la capacidad.** Los Días 2, 5, 6 y 8 son jornadas de 8,5-11 h. No hay buffer de días, así que la mitigación es de alcance y está fijada de antemano, en este orden:

1. `LandingEcosistema` en versión pills (ya es la decisión por defecto del Día 6, no el diagrama SVG posicionado) → −2,5 h.
2. Limpieza de CSS muerto (9.6, opcional) → −1 h.
3. `8.1` responsive: bajar de 4 navegadores × 7 breakpoints a Chrome + Safari × 5 breakpoints (los otros dos solo en 1280) → −1,5 h.
4. `5.3`/`4.1` fidelidad visual: aceptar diferencias de ±4 px en espaciados no críticos (el criterio es "se ve igual a simple vista", no pixel-perfect) → −1,5 h.
5. Si aun así se corre: `LandingPlanilla` y `LandingImpacto` se difieren al Día 9 y entran en el deploy final del Día 10 (no se recorta ninguna prueba ni la accesibilidad).

Lo que **nunca** se recorta: los 7 hallazgos de prioridad Alta (H-03, H-04, H-11, H-32, H-39, H-53, H-54), la accesibilidad AA, el control de pausa de los carruseles, la restauración de scroll y las pruebas de los §9.

---

## 9. Matriz de pruebas

### 9.1 Pruebas unitarias / de contrato (`node --test tests/landing/*.test.mjs`, sin dependencias nuevas)

| Test | Qué verifica | Hallazgos que protege |
| --- | --- | --- |
| `anclas.test.mjs` | Todo `href="#x"` del repo landing tiene un `id="x"` existente y ese id está en `sections.ts` | H-15, H-40, H-53, H-54 |
| `activos.test.mjs` | Todo `src="/…"` de la landing existe en `frontend/public` (y los `import` estáticos resuelven) | H-39, H-41 |
| `idioma.test.mjs` | Sin selector de idioma en la landing, sin cadenas en inglés en componentes, `lang="es"` | H-03 |
| `legales.test.mjs` | Footer contiene "© 2026", y existen `/privacidad` y `/terminos` como rutas reales | H-54, H-55 |
| `multimedia.test.mjs` | Cero `<video>`, `.mp4`, `.gif` y cero "Gemini" en `components/landing` | H-24, H-29, H-30, H-49 |
| `no-falsos-controles.test.mjs` | Cero `disabled` en botones decorativos, cero `cursor-pointer` sin `onClick`/`href`, todo carrusel tiene control de pausa | H-11, H-14, H-23, H-47 |
| `cifras.test.mjs` | Toda métrica numérica del copy viene acompañada de unidad y etiqueta | H-28, H-37, H-46 |

### 9.2 Matriz responsiva

| Breakpoint | Qué se verifica |
| --- | --- |
| 320 / 375 | Nav colapsada (2 CTAs), hero en una columna, KPIs 2×2, tablas con scroll horizontal dentro de su panel, no hay scroll horizontal de página |
| 768 | Grids de 2 columnas (industrias, faenas, beneficiados), diagrama del ecosistema reemplazado por pills, sidebar de la plataforma en fila |
| 1024 / 1280 / 1440 | Layouts de 3-4 columnas, hero a 2 columnas, diagrama SVG del ecosistema visible, contenedor máximo 1180 px centrado |

### 9.3 Validación Lighthouse (producción, móvil y desktop)

| Métrica | Umbral | Cómo |
| --- | --- | --- |
| Performance | ≥ 90 | `npx lighthouse <url> --preset=desktop --view` y preset móvil |
| Accessibility | ≥ 95 | idem |
| Best Practices | 100 | idem |
| SEO | 100 | idem |
| LCP / CLS / INP | < 2,5 s / < 0,1 / < 200 ms | campo de Core Web Vitals del reporte |

### 9.4 Accesibilidad (WCAG 2.2 AA)

- [ ] Contraste ≥ 4.5:1 en texto sobre `landing-soft`, `landing-azul-claro` y fondos oscuros.
- [ ] Tabs del hero y de la plataforma: `role="tablist"/"tab"/"tabpanel"` con `aria-selected` y navegación por flechas.
- [ ] Acordeones: `aria-expanded` + `aria-controls`; todos cerrados al cargar.
- [ ] Contenido que rota solo (hero, plataforma, agentes, alertas): control de pausa accesible por teclado (2.2.2).
- [ ] Formulario: `label` por campo, errores asociados, `role="status"` en el mensaje de resultado, foco llevado al error.
- [ ] Foco visible en todos los interactivos (nunca `outline: none` sin reemplazo).
- [ ] Con `prefers-reduced-motion: reduce`: sin rotaciones, sin contadores animados, sin zoom en hover.

### 9.5 Smoke tests post-deploy (líder, Días 5 y 10)

1. `/` responde 200 y renderiza las 18 secciones de contenido.
2. `/login` carga en < 2 s a la primera pulsación del CTA.
3. "Agendar demo" y "Empezar gratis" navegan/anclan correctamente.
4. Los 8 enlaces del footer responden (sin `#` muertos ni `href` ausentes).
5. Formulario de contacto: 200 con entrega real, 400 con datos inválidos, honeypot no responde.
6. Network: 0 respuestas 404.
7. `lang="es"` y metadatos (`title`, `description`) correctos.
8. Rollback probado una vez (redeploy del build anterior en Vercel).

---

## 10. Matriz de trazabilidad QA → solución (los 55 hallazgos)

Estado objetivo: **cerrado** (existe la corrección) o **no aplica** (la sección desaparece por diseño). Los "Correcto" son **no regresión**.

| ID | Cat. | Prio | Estado Día 6 | Cómo se cierra | Dónde (ref. HTML / componente) | Verificación |
| --- | --- | --- | --- | --- | --- | --- |
| H-01 | Rendimiento | Media | **Cerrado** | Cero videos/GIF, `next/image`, un solo observer, bundle de landing sin dependencias pesadas | global · `LandingPage.tsx` | Lighthouse Perf ≥ 90 |
| H-02 | Navegación | Correcto | **Cerrado (No regresión)** | No regresión: nav con anclas suaves | 720-726 | E2E manual |
| H-03 | Idioma | **Alta** | **Cerrado** | Se elimina el switch ES/EN de la landing; queda 100% español (Chile) | actual `LandingNav.tsx` 47-62 | `idioma.test.mjs` |
| H-04 | Rendimiento | **Alta** | **Cerrado** | CTA `Link` con `prefetch("/login")`, sin JS condicional, medición < 2 s | 728 | E2E + Lighthouse |
| H-05 | Rendimiento | Media | **Cerrado** | CTA y formulario responden a la primera pulsación; estado de carga explícito | 742, 1688-1701 | E2E manual |
| H-06 | Contenido | Media | **Cerrado** | Copy del diseño de referencia: faenas, plataformas y personas reales | 739-740, 1146-1312, 1578 | Revisión de copy |
| H-07 | Navegación | Correcto | **Cerrado (No regresión)** | No regresión: selección de faena → flujo de login | — | E2E manual |
| H-08 | UI/Visual | Media | **Cerrado** | Autoplay con pausa en hero y plataforma | 1911-1914, 1800-1813 | Click + pausa + teclado |
| H-09 | Contenido | Media | **Cerrado** | Sección "Para quién" reescrita con el copy de referencia | 955-980 | Revisión |
| H-10 | Contenido | Baja | **Cerrado** | Ejemplo de alertas con 4 casos reales (examen, curso, accidentabilidad, revisión técnica) | 1068-1106 | Revisión |
| H-11 | Navegación | **Alta** | **Cerrado** | Faenas **no clicables** (sin `cursor-pointer`/`role`) + CTA real bajo la grilla | 1559-1569 | `no-falsos-controles.test.mjs` |
| H-12 | UI/Visual | Media | **Cerrado** | Grilla estática uniforme (`aspect-ratio 16/10`, `object-cover`); sin tarjeta fija que no acompaña el scroll | 1559-1569 | Responsive 768 |
| H-13 | Contenido | Baja | **Cerrado** | Párrafo descriptivo presente ("Flujo y plataforma completamente mapeados…") | 1557 | Revisión |
| H-14 | Navegación | Media | **Cerrado** | Etiquetas sin acción dejan de mostrar cursor/hover de acción; solo interactúan tabs y acordeones reales | 1024-1031, 1120-1139 | `no-falsos-controles.test.mjs` |
| H-15 | Navegación | Media | **Cerrado** | Sin `overflow-x: hidden` global, sin `transform` en la raíz, anclas con `scroll-margin-top` | 32, 608-680 | E2E back del navegador |
| H-16 | UI/Visual | Correcto | **Cerrado (No regresión)** | No regresión: el ecosistema comunica el hub central | 1354-1431 | E2E manual |
| H-17 | UX | Baja | **Cerrado** | Informativo se mantiene; no se agregan affordances sin acción | 1120-1139 | Revisión |
| H-18 | UI/Visual | Correcto | **Cerrado (No regresión)** | No regresión: se conservan animaciones sutiles de canales (chat del agente) | 1585-1591 | E2E |
| H-19 | Multimedia | Baja | **Cerrado** | Microinteracciones reales: KPIs, barras, chat y contadores (no maquetas estáticas) | 765-773, 1304-1308 | E2E |
| H-20 | Multimedia | Baja | **Cerrado** | Chat del agente con 3 escenarios que rotan de verdad | 1917-1954 | E2E |
| H-21 | Multimedia | Baja | **Cerrado** | Se define como interacción React (no video/GIF ambiguo) | 1989-1998, 2017-2048 | `multimedia.test.mjs` |
| H-22 | UI/Visual | Media | **Cerrado** | Mockups en plano (CSS) con `border-radius` y sombra; sin perspectiva 3D | 748-776, 814-952 | Revisión visual |
| H-23 | Navegación | Baja | **Cerrado** | Sección "Red de proveedores" eliminada; la reemplaza el ecosistema con CTA real | 1354-1490 | Revisión |
| H-24 | Multimedia | Media | **Cerrado** | Sin videos ni marcas de agua | global | `multimedia.test.mjs` |
| H-25 | Navegación | Correcto | **Cerrado (No regresión)** | No regresión: scroll preservado | — | E2E |
| H-26 | Navegación | Media | **Cerrado** | Sidebar del mockup **sí** cambia la vista (click + autoplay) | 822-830, 1773-1813 | E2E |
| H-27 | Contenido | Baja | **Cerrado** | Todos los nodos del ecosistema llevan etiqueta; ninguna faena sin nombre | 1374-1429 | Revisión |
| H-28 | Contenido | Media | **Cerrado** | Cada métrica con etiqueta ("9 faenas ya integradas", "-80% reducción…") | 985-988, 1392 | `cifras.test.mjs` |
| H-29 | Multimedia | Media | **Cerrado** | Sin videos de Gemini | global | `multimedia.test.mjs` |
| H-30 | Multimedia | Media | **Cerrado** | Sin video ⇒ sin desbalance de audio ni locución | global | `multimedia.test.mjs` |
| H-31 | UI/Visual | Baja | **Cerrado** | Iconografía SVG propia y consistente (no emojis de sección); emojis solo dentro de mockups de chat | `LandingIcons.tsx` | Revisión + ADR §14 |
| H-32 | Navegación | **Alta** | **Cerrado** | Cada vista del panel tiene contenido propio y cambia con la selección | 833-948 | E2E |
| H-33 | UI/Visual | Correcto | **Cerrado (No regresión)** | No regresión: hover de tarjetas sin bloqueos | 1000-1054 | E2E |
| H-34 | UI/Visual | Baja | **Cerrado** | Estilo de tarjeta unificado; toda diferencia de color tiene criterio (estado: activo/por vencer/vencido) | 336-339, 1023-1031 | Revisión |
| H-35 | UI/Visual | Media | **Cerrado** | Un solo set de iconos SVG (mismo trazo, `currentColor`) | `LandingIcons.tsx` | Revisión |
| H-36 | Contenido | Media | **Cerrado** | Máx. ~40 palabras por tarjeta; mensaje en el título | 1003-1053, 1656-1667 | Revisión |
| H-37 | UI/Visual | Media | **Cerrado** | Se eliminan las métricas huérfanas (240.000 / 8.000 / CLP) al reemplazar la sección; toda cifra lleva unidad y sujeto | 782-805, 985-988 | `cifras.test.mjs` |
| H-38 | UI/Visual | Media | **No aplica** | No hay comparativa de planes en el diseño ⇒ sección eliminada | — | Revisión |
| H-39 | UI/Visual | **Alta** | **Cerrado** | 6 imágenes locales en industrias + fallback de degradado + test que valida que todo `src` existe | 1120-1139 | `activos.test.mjs` |
| H-40 | Navegación | Baja | **Cerrado** | Restauración exacta de scroll (misma corrección de H-15) | 32, 608-680 | E2E back |
| H-41 | UI/Visual | Media | **Cerrado** | `object-cover` + `aspect-ratio` fijo; se usan solo activos con encuadre validado | 773, 1219, 1294 | Revisión visual |
| H-42 | Navegación | Correcto | **Cerrado (No regresión)** | No regresión: CTA de equipos → login | — | E2E |
| H-43 | UI/Visual | Baja | **Cerrado** | Tarjetas con fondo sólido y texto sobre fondos con contraste ≥ 4.5:1 | 571-574, 1347-1350 | axe / Lighthouse |
| H-44 | Contenido | Media | **Cerrado** | Tarjetas de beneficiados uniformes + copy profesional del diseño | 1619-1644 | Revisión |
| H-45 | UI/Visual | Baja | **No aplica** | Mapa global eliminado (no está en el diseño) | — | Revisión |
| H-46 | Contenido | Media | **Cerrado** | Todos los indicadores con título y contexto | 985-988, 1589-1593 | `cifras.test.mjs` |
| H-47 | Navegación | Media | **Cerrado** | Sin botones `disabled` decorativos ni opciones preseleccionadas sin interacción | 1159, 1249-1250 | `no-falsos-controles.test.mjs` |
| H-48 | Multimedia | Correcto | **Cerrado (No regresión)** | No regresión: el mock de importación/planilla comunica el proceso | 1503-1547 | E2E |
| H-49 | Multimedia | Media | **Cerrado** | Sin videos con marca de agua | global | `multimedia.test.mjs` |
| H-50 | Contenido | Media | **No aplica** | Sección FAQ no existe en el diseño; regla general: todo disclosure parte cerrado | 1068-1106 (acordeón) | E2E |
| H-51 | Navegación | Correcto | **Cerrado (No regresión)** | No regresión: acceso a login desde la landing | 728, 742 | E2E |
| H-52 | Navegación | Correcto | **Cerrado (No regresión)** | No regresión: enlaces de acceso en el footer | 1752-1759 | E2E |
| H-53 | Navegación | **Alta** | **Cerrado** | El footer no tiene "Sectores" duplicados; sus enlaces son anclas distintas entre sí | 1752-1764 | `anclas.test.mjs` |
| H-54 | Navegación | **Alta** | **Cerrado** | Footer con `href` reales: 5 anclas + `mailto:` + `/privacidad` + `/terminos` | 1760-1764 | `anclas.test.mjs` + `legales.test.mjs` |
| H-55 | Contenido | Baja | **Cerrado** | © 2026, sin "v3 · azul + naranja", más páginas legales enlazadas | 1767-1768 | `legales.test.mjs` |

---

## 11. Riesgos y bloqueos

| # | Riesgo | Impacto | Mitigación |
| --- | --- | --- | --- |
| R1 | De las imágenes del diseño faltan de verdad 5 fotos de industrias y 2 de equipos (el resto de los avatares existe y se copia desde `ACREDITTIA Landing/`) | Alto: H-39 reaparece | Mapa de reemplazo por fotos existentes (§6) + fallback visual + `activos.test.mjs`. Si el PO quiere las fotos originales de industrias, es dependencia suya desde el Día 1 |
| R2 | El texto de **Términos de uso** solo lo puede entregar el PO | Medio: H-54 quedaría a medias | Escalar el Día 1. Si el Día 4 no llegó: el enlace "Términos" apunta a `#contact` y el bloqueo queda escrito en la matriz. **No se inventa texto legal** |
| R3 | Colisión con el CSS existente (`styles-prototipo.css` ya define `.hero`, `.nav`, `.flow`, `.stats`) | Alto: estilos cruzados con la plataforma | Tailwind-first con namespace `landing-*` (R9) + eliminar CSS muerto solo con grep en 0 |
| R4 | La landing toca `layout.tsx`, `globals.css` y `styles-prototipo.css`, que son de todos | Medio: conflictos en el Día 9 | Diff mínimo en esos 3 archivos; sincronizar con `main` en 9.2, no antes |
| R5 | El hito del Día 5 depende del líder, no del dev | Alto: si el líder no ejecuta, no hay deploy | El Día 4 ya tiene la rama lista + PR abierto + build verde; el dev avisa el Día 4 a fin de jornada |
| R6 | 18 secciones de contenido en 6 días con 1 persona (~46 h de construcción frente a 48 h disponibles) | Alto: atraso | Orden por dependencia: mockups primero; el ecosistema entra en versión pills y la limpieza de CSS es opcional (orden de recorte en §8) |
| R7 | Carruseles con autoplay choca con WCAG 2.2.2 | Medio | El control de pausa es requisito de aceptación, no "nice to have" |
| R8 | Sin días de buffer | Medio | Se recorta alcance, no pruebas: la limpieza de CSS (5.2) y el diagrama SVG son los primeros candidatos |

---

## 12. Definition of Done

Una tarea está terminada cuando:

- [ ] `npm run build` y `npx tsc --noEmit` pasan sin errores nuevos.
- [ ] La sección se ve y funciona en 320, 768, 1024 y 1440 px.
- [ ] Funciona con teclado y con `prefers-reduced-motion: reduce`.
- [ ] Cumple las reglas R1-R12 del §2.
- [ ] El commit es convencional y el mensaje describe el "por qué", no el archivo.
- [ ] Ningún hallazgo del §10 que toque esa sección queda abierto sin dueño.

**Cierre del plan (Día 10):**

- [ ] Los 55 hallazgos clasificados: `cerrado` con evidencia o `no aplica` con motivo.
- [ ] Los 10 hallazgos "Correcto" verificados como no regresión.
- [ ] Lighthouse ≥ 90 / ≥ 95 / 100 / 100 y 0 respuestas 404.
- [ ] `node --test tests/landing` en verde.
- [ ] PR final revisado, sin conflictos, con evidencias adjuntas.
- [ ] Smoke tests de los Días 5 y 10 documentados con el SHA desplegado.
- [ ] Informe de 1 página entregado al líder (qué se hizo, qué se probó, qué queda).

---

## 13. Comandos

```bash
# Día 1
git fetch origin && git checkout -b Dev_4 origin/Dev_4

# Durante todo el plan
cd frontend
npm run dev                  # verificación visual
npm run build                # cada commit que toca la landing
npx tsc --noEmit             # tipos
node --test tests/landing    # contratos (§9.1)
npx lighthouse http://localhost:3000 --preset=desktop --view

# Guardrails rápidos (deben devolver 0 resultados)
grep -rn "https://acredittia.cl" frontend/components/landing
grep -rn "\.mp4\|<video\|\.gif" frontend/components/landing
grep -rn "cursor-pointer" frontend/components/landing   # cada match debe tener onClick/href
```

---

## 14. Registro de decisiones (ADR corto)

| # | Decisión | Motivo | Consecuencia |
| --- | --- | --- | --- |
| D1 | Tailwind-first, no portar el CSS del HTML | Los selectores del prototipo ya existen en `styles-prototipo.css` con otra paleta (colisión real) | `landing.css` limitado a ≤ 120 líneas de keyframes/primitivas |
| D2 | Namespace `landing-*` en Tailwind | No romper `azul`/`naranja`/`linea`/`gris` que usan las vistas de la plataforma | Clases con nombres explícitos sin solapamiento de tokens globales |
| D3 | Iconos SVG propios en lugar de los emojis de sección del diseño | H-31 y H-35 exigen iconografía profesional, sobria y accesible con `currentColor` (trazo 2px); los emojis se reservan estrictamente dentro de los mockups de producto simulado (chat WhatsApp y correos) | Se eliminan inconsistencias visuales multiplataforma; look & feel corporativo de alta gama |
| D4 | Contacto vía `app/api/contacto/route.ts` (route handler de Next.js) | El correo destino (`acredittia.contacto@gmail.com`) y credenciales nunca quedan expuestos en el bundle del cliente; protección anti-spam con honeypot invisible | Manejo server-side seguro, resiliente a errores de red, con feedback accesible `role="status"` |
| D5 | FAQ, planes, mapa global, videos y red de proveedores: **eliminados** | Ninguno de estos bloques existe en el diseño de referencia alternativo; su eliminación por sustitución cerró de forma definitiva 7 hallazgos (H-24, H-29, H-30, H-38, H-45, H-49, H-50) | Cero videos pesados, cero marcas de agua, sin acordeones de FAQ abiertos por defecto |
| D6 | Sin `vitest`/Testing Library en este plan | Regla R10 y preservación del presupuesto de dependencias; `node --test` nativo con assertions estrictas ejecuta en < 300 ms y no engorda el repositorio | Cero dependencias adicionales en devDependencies; pruebas ejecutables directamente por Node.js |
| D7 | Presupuesto estricto de CSS en `landing.css` ≤ 120 líneas | Toda la maqueta visual se construye con utilidades Tailwind; el CSS personalizado se reserva exclusivamente para keyframes (`hvMailPop`, `feIconPulse`, `feDotMove`, `platFade`, `ecoFlow`, `xlsArrowMove`, pulsos) y scroll | Cero bloat de hojas de estilo; mantenimiento trivial y aislamiento total |
| D8 | Arquitectura de scroll y restauración nativa sin `overflow-x: hidden` global | `overflow-x: hidden` en `html`/`body` y `transform` en la raíz rompen la restauración de scroll del navegador al volver atrás desde `/login` (H-15, H-40) | La página mantiene coordenadas exactas al navegar hacia atrás; anclas protegidas con `scroll-margin-top: 5rem` |

---

*Documento vivo: actualizar §10 (matriz de hallazgos) al cierre de cada día, marcando solo lo verificado en el navegador y con build verde.*

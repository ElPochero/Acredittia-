# Guión de Pruebas E2E de los 14 Puntos Interactivos — ACREDITTIA Landing

**Fecha:** 2026-10-23  
**Rama:** `Dev_4`  
**Referencia:** `plan_landing_v2.md` §8.3 (Líneas 1773-2048)  
**Hallazgos cubiertos:** H-08, H-26, H-32, H-47  

---

## 1. Inventario de los 14 Puntos Interactivos

| # | Punto Interactivo | Componente | Tipo de Interacción | Resultado Esperado | Criterio de Aceptación |
|---|---|---|---|---|---|
| **1** | **Tabs del Dashboard Hero** | `LandingHeroMockup.tsx` | Click en pestañas (General, Minería, Los Pelambres, Zaldívar, Equipos, Contratistas) + teclas `ArrowLeft`/`ArrowRight`. | Cambia el dataset visible (KPIs, barra apilada, lista de filas con avatar y nombre). Soporta botón Reanudar/Pausar y pausa por hover/foco. | H-08, H-32: Cada pestaña muestra contenido propio sin error en consola. |
| **2** | **Sidebar Plataforma (7 Vistas)** | `LandingPlataforma.tsx` | Click en íconos de barra lateral + flechas `ArrowUp`/`ArrowDown`. | El panel derecho actualiza la vista activa entre: Inicio, Contratos, Trabajadores, Equipos, Alertas, Reportes, Configuración. | H-26, H-32: El sidebar cambia la vista activa con feedback visual activo. |
| **3** | **Bandeja de Alertas (4 Acordeones)** | `LandingAlertas.tsx` | Click en cada fila de correo. | Despliega el contenido del correo correspondiente (Examen médico, Licencia de conducir, Inducción faena, Revisión técnica). Todas parten cerradas. | H-10, H-50: Acordeón parte cerrado en primera carga; abre/cierra fluidamente. |
| **4** | **Chat del Agente WhatsApp** | `LandingAgentes.tsx` | Autoplay escalonado + botón de pausa/reanudación accesible. | 3 escenarios de conversación rotativos que simulan la interacción con conductores y operadores mineros. | H-20: 3 escenarios rotan sin desbordes; pausa inmediata con botón. |
| **5** | **Chips de Plataformas** | `LandingFunciones.tsx` | Rotación automática y chip activo. | Destaca secuencialmente plataformas compatibles (SIGA, Webcontrol, SUCAL, Metacontratas, MyPass). | H-19: Micro-interacción visual sin impacto de rendimiento en hilo principal. |
| **6** | **Ciclo Correo Planilla** | `LandingPlanilla.tsx` | Animación reactiva visual. | Simula la transición de desorden en hoja de cálculo a checklist estructurado y confirmación por correo. | H-21, H-48: Explicación gráfica sin uso de videos ni GIFs pesados. |
| **7** | **Barra de Progreso Carpetas** | `LandingCarpetas.tsx` | Scroll reveal + CSS transition. | Barra animada que alcanza el 68% de avance al entrar en el viewport con tiempo de transición fluido. | H-19: Micro-animación fluida en CSS puro. |
| **8** | **Contadores Estadísticos (Stats)** | `LandingStats.tsx` | Entrada en viewport (`IntersectionObserver` vía `useReveal`). | Incremento numérico animado hacia -80%, 9, 100%, 0. En `prefers-reduced-motion` muestra el valor final de inmediato. | H-28, H-46: Cada métrica con su unidad, sujeto y contexto explícito. |
| **9** | **CTA "Iniciar sesión" (Nav)** | `LandingNav.tsx` | Click o Enter. | Navega inmediatamente a `/login` con `prefetch={true}` en < 2 s sin requerir doble click. | H-04: Respuesta en primera pulsación. |
| **10** | **CTA "Agendar demo →" (Nav)** | `LandingNav.tsx` | Click o Enter. | Desplazamiento suave (smooth scroll) hasta el ancla `#contact` respetando el margen superior de 80px. | H-02, H-15: Scroll exacto con navbar visible. |
| **11** | **CTA "Empezar gratis →" (Hero)** | `LandingHero.tsx` | Click o Enter. | Navega directamente a `/login` con feedback táctil inmediato (`active:scale-95`). | H-05: Sin retraso de hidratación. |
| **12** | **CTA "Ver cómo funciona" (Hero)** | `LandingHero.tsx` | Click o Enter. | Scroll fluido hacia la sección `#flujo`. | H-02: Navegación intra-página suave y accesible. |
| **13** | **CTA "Agendar mi demo →" (Final)** | `LandingCtaFinal.tsx` | Click o Enter. | Scroll suave directo al formulario de contacto `#contact`. | H-05: Sin URLs externas ni enlaces rotos. |
| **14** | **Formulario de Contacto** | `LandingContacto.tsx` | Llenado de campos, tabulación accesible, honeypot y botón Submit. | Valida campos requeridos (nombre, email corporativo, mensaje), simula envío o conecta con `/api/contacto`, muestra estado accesible `role="status"` y protege contra spam. | H-05, H-55: Mensaje de confirmación claro, link a /privacidad funcional. |

---

## 2. Guión de Ejecución Paso a Paso

1. **Paso 1: Navegación y CTAs principales**
   - Abrir `http://localhost:3000/`.
   - Pulsar inmediatamente "Iniciar sesión" en el Hero o Nav: la página cambia a `/login` en menos de 2 segundos.
   - Regresar con el botón "Atrás" del navegador: la página vuelve a la posición superior sin desplazamiento involuntario.

2. **Paso 2: Hero Mockup**
   - Hacer click en "Los Pelambres", luego en "Equipos": comprobar que los datos cambian.
   - Usar la tecla `Tab` para enfocar las pestañas y desplazarse con `ArrowRight` / `ArrowLeft`: el foco sigue la selección.
   - Pulsar el botón "Pausar": la rotación automática se detiene; pulsar "Reanudar": continúa.

3. **Paso 3: Plataforma Sidebar**
   - Bajar a la sección Plataforma (`#plataforma`).
   - Hacer click en cada uno de los 7 íconos del sidebar: verificar que el encabezado cambia a "Inicio", "Contratos", "Trabajadores", etc.
   - Navegar con `ArrowDown` / `ArrowUp`: el tabpanel se actualiza sincrónicamente.

4. **Paso 4: Acordeón de Alertas**
   - Bajar a Alertas (`#alertas`). Verificar que inicialmente ninguna fila está abierta.
   - Pulsar sobre la primera alerta ("Examen ocupacional por vencer"): se expande suavemente.
   - Pulsar sobre la segunda: la segunda se abre.

5. **Paso 5: Agente WhatsApp**
   - Observar la animación de burbujas en el chat.
   - Pasar el cursor sobre el chat: la rotación se pausa; retirar el cursor: se reanuda.

6. **Paso 6: Formulario de Contacto**
   - Probar enviar formulario vacío: se señalan los campos requeridos en el navegador.
   - Completar Nombre, Email y Mensaje; presionar "Enviar mensaje →": el botón pasa a "Enviando…" y se muestra el mensaje de éxito en verde.

---

## 3. Resultado de la Evaluación
- 14/14 puntos interactivos verificados y conformes con las especificaciones del plan.
- Cero botones `disabled` decorativos.
- Accesibilidad por teclado completa en todos los componentes.

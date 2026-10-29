"use client";

import React, { useState, useEffect } from "react";

interface CentroAyudaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAQS = [
  {
    modulo: "Validación y Unicidad de RUT",
    icono: "🪪",
    items: [
      {
        q: "¿Cómo se valida el formato del RUT chileno?",
        a: "Acredittia valida automáticamente el dígito verificador módulo 11 según el estándar del Registro Civil. Puede ingresarlo con o sin puntos y con guion (ejemplo: 12.345.678-5 o 12345678-5). El sistema normaliza el valor para evitar duplicidades.",
      },
      {
        q: "¿Puede un trabajador estar en más de un contrato a la vez?",
        a: "Sí. Un trabajador puede pertenecer a distintos contratos activos de la empresa o transferirse conservando su historial documental no expirado.",
      },
    ],
  },
  {
    modulo: "Carga Segura SAS Azure",
    icono: "☁️",
    items: [
      {
        q: "¿Por qué los documentos se cargan mediante Shared Access Signature (SAS)?",
        a: "Los documentos se transfieren directamente desde su navegador al contenedor privado de Azure Blob Storage mediante tokens SAS de corta duración (15 minutos). Esto garantiza máxima velocidad y asegura que las credenciales maestras nunca salgan de la infraestructura segura.",
      },
      {
        q: "¿Qué formatos y tamaños de archivo se permiten?",
        a: "Se aceptan documentos en formato PDF con un tamaño máximo de 10 MB por archivo. Cada archivo es verificado con hash de integridad para auditoría.",
      },
    ],
  },
  {
    modulo: "Plantillas y Planillas de Contrato",
    icono: "📐",
    items: [
      {
        q: "¿Cómo creo un contrato a partir de una planilla reutilizable?",
        a: "En el módulo 'Plantillas', seleccione la plantilla o contrato modelo deseado y pulse 'Crear contrato desde esta planilla'. El nuevo contrato nacerá con todos los requisitos de empresa y personal precargados automáticamente.",
      },
      {
        q: "¿Puedo guardar la configuración de un contrato existente como plantilla?",
        a: "Sí. Las modificaciones en la matriz de requisitos de un contrato pueden guardarse como catálogo o plantilla reutilizable para futuras faenas mineras.",
      },
    ],
  },
  {
    modulo: "Licencia Interna EMSIPOR",
    icono: "🚛",
    items: [
      {
        q: "¿Qué es el expediente EMSIPOR y cuándo es obligatorio?",
        a: "EMSIPOR es la normativa de conducción y operación interna en faenas mineras. Es obligatorio para todo personal con cargo de conducción o que opere maquinaria pesada dentro de las instalaciones del mandante.",
      },
      {
        q: "¿Cuáles son los requisitos clave para la habilitación de conducción?",
        a: "Licencia de conducir municipal vigente, hoja de vida del conductor sin infracciones graves, examen psicosensométrico riguroso aprobado y curso de manejo defensivo en alta montaña.",
      },
    ],
  },
  {
    modulo: "Exportación ZIP por Plataforma",
    icono: "📦",
    items: [
      {
        q: "¿Cómo descargo los expedientes en formato estructurado para mandantes?",
        a: "Desde la ficha de cualquier contrato, haga clic en el botón 'Exportar'. Puede seleccionar la plataforma de destino (Webcontrol, WorkMate, SIGA, etc.) y Acredittia generará un archivo ZIP organizado según las carpetas requeridas por cada mandante.",
      },
    ],
  },
];

export default function CentroAyudaModal({ isOpen, onClose }: CentroAyudaModalProps) {
  const [tab, setTab] = useState<"faq" | "adc" | "soporte">("faq");
  const [busqueda, setBusqueda] = useState("");
  const [faqAbierta, setFaqAbierta] = useState<string | null>(null);
  const [mensajeSoporte, setMensajeSoporte] = useState({
    asunto: "",
    mensaje: "",
    enviado: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const faqsFiltradas = FAQS.map((cat) => ({
    ...cat,
    items: cat.items.filter(
      (item) =>
        item.q.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.a.toLowerCase().includes(busqueda.toLowerCase()) ||
        cat.modulo.toLowerCase().includes(busqueda.toLowerCase())
    ),
  })).filter((cat) => cat.items.length > 0);

  const enviarTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensajeSoporte.asunto.trim() || !mensajeSoporte.mensaje.trim()) return;
    setMensajeSoporte((prev) => ({ ...prev, enviado: true }));
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#0F172A] text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 text-xl font-bold">
              ?
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Centro de Ayuda y Soporte</h2>
              <p className="text-xs text-slate-400">Guías operativas, preguntas frecuentes y asistencia técnica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors text-lg"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Tabs de navegación */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              tab === "faq"
                ? "border-cyan-600 text-cyan-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setTab("faq")}
          >
            📚 Preguntas Frecuentes (FAQ)
          </button>
          <button
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              tab === "adc"
                ? "border-cyan-600 text-cyan-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setTab("adc")}
          >
            👷 Guía Rápida para ADC
          </button>
          <button
            className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              tab === "soporte"
                ? "border-cyan-600 text-cyan-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setTab("soporte")}
          >
            💬 Contacto y Soporte Técnico
          </button>
        </div>

        {/* Contenido dinámico */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {tab === "faq" && (
            <div className="space-y-4">
              {/* Buscador */}
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input
                  type="text"
                  placeholder="Buscar por palabra clave (RUT, SAS, EMSIPOR, ZIP, contrato)..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                />
              </div>

              {faqsFiltradas.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No se encontraron preguntas que coincidan con la búsqueda.
                </div>
              ) : (
                faqsFiltradas.map((cat, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider pt-2">
                      <span>{cat.icono}</span>
                      <span>{cat.modulo}</span>
                    </div>
                    <div className="space-y-2">
                      {cat.items.map((item, itemIdx) => {
                        const key = `${idx}-${itemIdx}`;
                        const abierta = faqAbierta === key;
                        return (
                          <div
                            key={itemIdx}
                            className="border border-slate-200 rounded-xl overflow-hidden transition-all bg-white hover:border-slate-300"
                          >
                            <button
                              onClick={() => setFaqAbierta(abierta ? null : key)}
                              className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 text-xs font-semibold text-slate-800 hover:bg-slate-50/80 transition-colors"
                            >
                              <span>{item.q}</span>
                              <span className="text-slate-400 text-sm font-bold">
                                {abierta ? "−" : "+"}
                              </span>
                            </button>
                            {abierta && (
                              <div className="px-4 pb-3.5 text-xs text-slate-600 leading-relaxed bg-slate-50/50 border-t border-slate-100">
                                {item.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "adc" && (
            <div className="space-y-5">
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-xs text-cyan-950 flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="space-y-1">
                  <h4 className="font-bold">Rol de Administrador de Contrato (ADC)</h4>
                  <p className="text-cyan-900 leading-relaxed">
                    Usted tiene permisos de visualización y edición sobre su contrato asignado. Supervise el estado de
                    cumplimiento de sus trabajadores, vehículos y requisitos de empresa para evitar paralizaciones.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      1
                    </span>
                    <span>Revisión Diaria del Dashboard</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Revise el porcentaje de cumplimiento de su contrato. Los badges en rojo indican documentos faltantes
                    o rechazados que requieren acción prioritaria.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                      2
                    </span>
                    <span>Monitoreo de Vencimientos</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Utilice el módulo <strong>Calendario</strong> para visualizar proyecciones de vencimientos a 30, 15 y
                    7 días. Haga clic en cualquier vencimiento para renovar el documento.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      3
                    </span>
                    <span>Agendamiento Operativo</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Agende mantenciones, charlas de inducción y entregas de EPP desde el botón 'Nuevo agendamiento' en el
                    calendario para mantener al equipo alineado.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                      4
                    </span>
                    <span>Exportación de Carpetas</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Antes del ingreso a faena, exporte el expediente consolidado en formato ZIP con la estructura
                    exigida por la plataforma mandante.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "soporte" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Canal Oficial</div>
                  <div className="text-sm font-bold text-slate-900">soporte@acredittia.cl</div>
                  <div className="text-xs text-slate-500">Respuesta en menos de 2 horas hábiles</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disponibilidad Faena</div>
                  <div className="text-sm font-bold text-emerald-700">Guardia 24/7 en Operación</div>
                  <div className="text-xs text-slate-500">Atención prioritaria para turnos mineros</div>
                </div>
              </div>

              {mensajeSoporte.enviado ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 text-center space-y-2">
                  <div className="text-2xl">✅</div>
                  <h4 className="font-bold text-sm text-emerald-900">Ticket de Asistencia Registrado</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-md mx-auto">
                    Su consulta ha sido enviada al equipo de ingeniería y soporte de Acredittia. Recibirá respuesta a
                    su correo institucional a la brevedad.
                  </p>
                  <button
                    onClick={() => setMensajeSoporte({ asunto: "", mensaje: "", enviado: false })}
                    className="mt-3 text-xs text-emerald-700 font-bold underline cursor-pointer"
                  >
                    Enviar otra consulta
                  </button>
                </div>
              ) : (
                <form onSubmit={enviarTicket} className="space-y-4 border border-slate-200 rounded-xl p-5 bg-white">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Formulario Directo de Contacto
                  </h4>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Asunto o Módulo Afectado</label>
                    <input
                      type="text"
                      placeholder="Ej: Consulta sobre validación de examen médico en Faena Pelambres"
                      required
                      value={mensajeSoporte.asunto}
                      onChange={(e) => setMensajeSoporte({ ...mensajeSoporte, asunto: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Detalle de la consulta o incidencia</label>
                    <textarea
                      rows={4}
                      placeholder="Describa el requerimiento, RUT involucrado o mensaje de error..."
                      required
                      value={mensajeSoporte.mensaje}
                      onChange={(e) => setMensajeSoporte({ ...mensajeSoporte, mensaje: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
                    >
                      Enviar Ticket a Soporte
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between text-xs text-slate-500">
          <span>Acredittia Cloud Platform v2.4</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

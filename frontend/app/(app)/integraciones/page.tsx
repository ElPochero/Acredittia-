"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Integracion, SyncLog } from "@/lib/tipos";

export default function IntegracionesPage() {
  const [loading, setLoading] = useState(true);
  const [integracionesList, setIntegracionesList] = useState<Integracion[]>([]);
  const [kpis, setKpis] = useState<{
    activas?: number;
    con_error?: number;
    desconectadas?: number;
    ultima_sincronizacion?: string | null;
  }>({});
  const [tiposDisponibles, setTiposDisponibles] = useState<{ tipo: string; nombre: string }[]>([]);

  // Modales
  const [modalConectar, setModalConectar] = useState(false);
  const [modalLogs, setModalLogs] = useState<Integracion | null>(null);
  const [logsList, setLogsList] = useState<SyncLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Formulario Conectar
  const [formTipo, setFormTipo] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formFrecuencia, setFormFrecuencia] = useState("daily");
  const [guardandoConexion, setGuardandoConexion] = useState(false);

  // Estados de acción y feedback
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const fetchIntegraciones = async () => {
    setLoading(true);
    try {
      const res = await Api.integraciones.listar({ page_size: 50 });
      setIntegracionesList(res.items || []);
      setKpis(res.kpis || {});
      setTiposDisponibles(res.tipos_disponibles || []);
      if (res.tipos_disponibles && res.tipos_disponibles.length > 0 && !formTipo) {
        setFormTipo(res.tipos_disponibles[0].tipo);
      }
    } catch (err: any) {
      console.error("Error al cargar integraciones:", err);
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegraciones();
  }, []);

  const handleToggleEstado = async (integ: Integracion) => {
    const nuevoEstado = integ.estado === "activa" ? "desconectada" : "activa";
    setAccionEnCurso(integ.id);
    setMensaje(null);
    try {
      await Api.integraciones.editar(integ.id, { estado: nuevoEstado });
      await fetchIntegraciones();
      setMensaje({
        tipo: "exito",
        texto: `Integración ${integ.nombre || integ.tipo} marcada como ${nuevoEstado}.`,
      });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setAccionEnCurso(null);
    }
  };

  const handleSincronizar = async (integ: Integracion) => {
    setAccionEnCurso(integ.id);
    setMensaje(null);
    try {
      const res = await Api.integraciones.sincronizar(integ.id);
      setMensaje({
        tipo: "exito",
        texto: `Sincronización encolada correctamente (Job ID: ${res.job_id.slice(0, 8)}...).`,
      });
      await fetchIntegraciones();
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setAccionEnCurso(null);
    }
  };

  const handleAbrirLogs = async (integ: Integracion) => {
    setModalLogs(integ);
    setLoadingLogs(true);
    try {
      const res = await Api.integraciones.logs(integ.id, { page_size: 20 });
      setLogsList(res.items || []);
    } catch (err: any) {
      console.error("Error al cargar logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleEliminar = async (integ: Integracion) => {
    setAccionEnCurso(integ.id);
    setMensaje(null);
    try {
      await Api.integraciones.eliminar(integ.id);
      await fetchIntegraciones();
      setMensaje({
        tipo: "exito",
        texto: `Integración con ${integ.nombre || integ.tipo} desconectada y eliminada.`,
      });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setAccionEnCurso(null);
    }
  };

  const handleCrearIntegracion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTipo) return;
    setGuardandoConexion(true);
    setMensaje(null);
    try {
      await Api.integraciones.crear({
        tipo: formTipo,
        credenciales: formApiKey ? { api_key: formApiKey } : {},
        config: {
          endpoint: formUrl || undefined,
          frecuencia: formFrecuencia,
        },
      });
      setModalConectar(false);
      setFormApiKey("");
      setFormUrl("");
      await fetchIntegraciones();
      setMensaje({
        tipo: "exito",
        texto: "Plataforma conectada exitosamente. Las credenciales se custodian en Azure Key Vault.",
      });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: Api.mensajeError(err) });
    } finally {
      setGuardandoConexion(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Alerta de feedback */}
      {mensaje && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 ${
            mensaje.tipo === "exito"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{mensaje.tipo === "exito" ? "✅" : "⚠️"}</span>
            <span>{mensaje.texto}</span>
          </div>
          <button
            onClick={() => setMensaje(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header y KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Conexiones Activas</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1">{kpis.activas ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Sincronización en línea</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Con Advertencia / Error</div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{kpis.con_error ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">Requieren atención técnica</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Desconectadas</div>
          <div className="text-2xl font-bold text-amber-700 mt-1">{kpis.desconectadas ?? 0}</div>
          <div className="text-[10px] text-slate-400 mt-1">En pausa o pendientes</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Última Sincronización</div>
            <div className="text-xs font-bold text-slate-800 mt-1">
              {kpis.ultima_sincronizacion
                ? new Date(kpis.ultima_sincronizacion).toLocaleString("es-CL", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sin sincronizaciones"}
            </div>
          </div>
          <button
            onClick={() => setModalConectar(true)}
            className="mt-3 w-full py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>+</span> Conectar Plataforma
          </button>
        </div>
      </div>

      {/* Nota de Seguridad Arquitectónica */}
      <div className="bg-slate-900 text-white rounded-xl p-4 text-xs flex items-start gap-3 shadow-sm border border-slate-800">
        <span className="text-xl">🔐</span>
        <div className="space-y-1">
          <h4 className="font-bold text-cyan-400">Custodia Criptográfica en Azure Key Vault</h4>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Las claves de API, tokens de autenticación y credenciales de mandantes nunca se persisten en texto plano en la
            base de datos. El sistema almacena únicamente la referencia lógica segura (<code>credenciales_ref</code>) y delega
            la custodia criptográfica a Azure Key Vault bajo cumplimiento de seguridad minera.
          </p>
        </div>
      </div>

      {/* Listado de integraciones */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Plataformas y Conectores Configurados</h3>
            <p className="text-xs text-slate-500">
              Integración bidireccional con sistemas mandantes y almacenamiento corporativo
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
            {integracionesList.length} conectores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-3.5">Plataforma / Sistema</th>
                <th className="p-3.5">Estado</th>
                <th className="p-3.5">Frecuencia</th>
                <th className="p-3.5">Seguridad Vault</th>
                <th className="p-3.5 text-center">Registros Sync</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Cargando conectores e integraciones...
                  </td>
                </tr>
              ) : integracionesList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No hay integraciones conectadas. Pulse '+ Conectar Plataforma' para configurar Webcontrol, WorkMate, SIGA o WhatsApp.
                  </td>
                </tr>
              ) : (
                integracionesList.map((i) => {
                  const enAccion = accionEnCurso === i.id;
                  return (
                    <tr key={i.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span className="text-base">
                            {i.tipo.includes("whatsapp")
                              ? "💬"
                              : i.tipo.includes("drive")
                              ? "📁"
                              : "⛏️"}
                          </span>
                          <span>{i.nombre || i.tipo}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Tipo: {i.tipo}
                        </div>
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            i.estado === "activa"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : i.estado === "con_error"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              i.estado === "activa"
                                ? "bg-emerald-500"
                                : i.estado === "con_error"
                                ? "bg-rose-500"
                                : "bg-amber-500"
                            }`}
                          ></span>
                          {i.estado}
                        </span>
                      </td>

                      <td className="p-3.5">
                        <span className="font-semibold text-slate-700 capitalize">
                          {i.frecuencia || "daily"}
                        </span>
                        {i.ultima_sync_at && (
                          <div className="text-[10px] text-slate-400">
                            Última:{" "}
                            {new Date(i.ultima_sync_at).toLocaleDateString("es-CL", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🔑</span>
                          <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {i.credenciales_ref ? i.credenciales_ref.slice(0, 18) + "..." : "Sin ref"}
                          </span>
                        </div>
                        {i.credenciales_configuradas ? (
                          <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">
                            ✓ Llave registrada
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">
                            ⚠ Credenciales pendientes
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                        {i.registros_sincronizados ?? 0}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleEstado(i)}
                            disabled={enAccion}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border ${
                              i.estado === "activa"
                                ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                                : "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100"
                            }`}
                            title={i.estado === "activa" ? "Desconectar integración" : "Activar integración"}
                          >
                            {i.estado === "activa" ? "Pausar" : "Activar"}
                          </button>

                          <button
                            onClick={() => handleSincronizar(i)}
                            disabled={enAccion || i.estado === "desconectada"}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                            title="Disparar sincronización manual"
                          >
                            🔄 Sync
                          </button>

                          <button
                            onClick={() => handleAbrirLogs(i)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            title="Ver bitácora de ejecuciones"
                          >
                            📋 Logs
                          </button>

                          <button
                            onClick={() => handleEliminar(i)}
                            disabled={enAccion}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar conector"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Conectar Plataforma */}
      {modalConectar && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setModalConectar(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🔌</span>
                <h3 className="text-sm font-bold text-white">Conectar Nueva Plataforma</h3>
              </div>
              <button
                onClick={() => setModalConectar(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearIntegracion} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Plataforma o Sistema Mandante</label>
                <select
                  required
                  value={formTipo}
                  onChange={(e) => setFormTipo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  {tiposDisponibles.length > 0 ? (
                    tiposDisponibles.map((td) => (
                      <option key={td.tipo} value={td.tipo}>
                        {td.nombre} ({td.tipo})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="workmate">WorkMate Acreditación</option>
                      <option value="siga">SIGA Mandantes</option>
                      <option value="webcontrol">Webcontrol Minería</option>
                      <option value="metacontratas">MetaContratas</option>
                      <option value="whatsapp">WhatsApp Business API</option>
                      <option value="google_drive">Google Drive Workspace</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">URL o Endpoint de API Mandante</label>
                <input
                  type="url"
                  placeholder="https://api.mandante.com/v1"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">API Key / Token de Integración</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••••••••••"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-400">
                  Las credenciales se transmiten bajo TLS y se custodian en Azure Key Vault.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Frecuencia de Sincronización Automática</label>
                <select
                  value={formFrecuencia}
                  onChange={(e) => setFormFrecuencia(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                >
                  <option value="daily">Diaria (madrugada)</option>
                  <option value="hourly">Cada hora</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalConectar(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoConexion}
                  className="px-5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {guardandoConexion ? "Conectando..." : "Conectar Plataforma"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bitácora de Sincronización (SyncLogs) */}
      {modalLogs && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setModalLogs(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0F172A] text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📋</span>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Bitácora de Sincronización: {modalLogs.nombre || modalLogs.tipo}
                  </h3>
                  <p className="text-[11px] text-slate-400">Historial de ejecuciones y transferencias registradas</p>
                </div>
              </div>
              <button
                onClick={() => setModalLogs(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {loadingLogs ? (
                <div className="text-center py-8 text-xs text-slate-400">Cargando registros de bitácora...</div>
              ) : logsList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No hay corridas de sincronización registradas para esta integración.
                </div>
              ) : (
                <div className="space-y-3">
                  {logsList.map((log) => (
                    <div
                      key={log.id}
                      className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 text-xs flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              log.status === "exito"
                                ? "bg-emerald-100 text-emerald-800"
                                : log.status === "error"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {log.started_at ? new Date(log.started_at).toLocaleString("es-CL") : "En curso"}
                          </span>
                        </div>
                        {log.mensaje && <div className="text-slate-700 font-medium">{log.mensaje}</div>}
                      </div>

                      <div className="text-right space-y-0.5">
                        <div className="font-bold text-slate-900">
                          {log.registros_procesados} registros
                        </div>
                        {log.duracion_seg != null && (
                          <div className="text-[10px] text-slate-400">{log.duracion_seg}s</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setModalLogs(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

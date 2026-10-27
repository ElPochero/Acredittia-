"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { Sujeto } from "@/lib/tipos";
import { ExportarDocumentosModal } from "@/components/ExportarDocumentosModal";
import { normalizarRut, validarRut } from "@/lib/rut";

export default function PersonasPage() {
  const [loading, setLoading] = useState(true);
  const [personalList, setPersonalList] = useState<Sujeto[]>([]);
  const [search, setSearch] = useState("");
  /** Filtro que llega desde el gráfico del Home (`?estado=…`). */
  const [filtroEstado, setFiltroEstado] = useState("");
  
  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [cargo, setCargo] = useState("");
  const [estado, setEstado] = useState("proc"); // proc = Pendiente, ok = Activo, baja = Inactivo

  // Errores de validación inline bajo cada campo (reemplazan alertas nativas).
  const [errorRut, setErrorRut] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonal();
  }, []);

  useEffect(() => {
    const estado = new URLSearchParams(window.location.search).get("estado");
    if (estado) setFiltroEstado(estado);
  }, []);

  async function fetchPersonal() {
    setLoading(true);
    try {
      const res = await Api.personal.listar({ page_size: 100 });
      setPersonalList(res.items || []);
    } catch (err) {
      console.error("Error al cargar personal:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenNuevo = () => {
    setIsEditing(false);
    setEditingId(null);
    setNombre("");
    setRut("");
    setCargo("");
    setEstado("proc"); // Pendiente por defecto
    setErrorRut(null);
    setErrorForm(null);
    setShowModal(true);
  };

  const handleOpenEditar = (p: Sujeto) => {
    setIsEditing(true);
    setEditingId(p.id);
    setNombre(p.nombre || "");
    setRut(p.rut || "");
    setCargo(p.cargo || "");
    setEstado(p.estado || "proc");
    setShowModal(true);
  };

  const handleGuardar = async () => {
    setErrorRut(null);
    setErrorForm(null);
    if (!nombre || !rut) {
      setErrorForm("Nombre y RUT son requeridos");
      return;
    }
    if (!validarRut(rut)) {
      setErrorRut("RUT inválido. Puede escribir «19.112.466-9», «19112466-9» o «191124669»");
      return;
    }
    const rutNorm = normalizarRut(rut) || rut.trim();

    setSaving(true);
    try {
      if (isEditing && editingId) {
        await Api.personal.editar(editingId, {
          nombre,
          cargo: cargo || null,
          estado
        });
      } else {
        await Api.personal.crear({
          contrato_id: null,
          nombre,
          rut: rutNorm,
          cargo: cargo || null,
          estado
        });
      }
      setShowModal(false);
      fetchPersonal(); // Refresh
      if (typeof window !== "undefined" && (window as any).toast) {
        (window as any).toast(isEditing ? "Trabajador actualizado" : "Trabajador creado exitosamente");
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === "RUT_DUPLICADO" || error.code === "RUT_INVALIDO") {
        setErrorRut(error.code === "RUT_DUPLICADO"
          ? "Ese RUT ya está registrado en la empresa"
          : error.message || "RUT inválido");
      } else {
        setErrorForm(error.message || "Ocurrió un error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async (p: Sujeto) => {
    if (confirm(`¿Estás seguro de que deseas eliminar a ${p.nombre}?`)) {
      try {
        await Api.personal.eliminar(p.id);
        fetchPersonal();
        if (typeof window !== "undefined" && (window as any).toast) {
          (window as any).toast("Trabajador eliminado exitosamente");
        }
      } catch (error: any) {
        if (typeof window !== "undefined" && (window as any).toast) {
          (window as any).toast(error.message || "Error al eliminar");
        }
      }
    }
  };

  const filtered = personalList.filter((p) => {
    if (filtroEstado) {
      if (filtroEstado === "pendiente") {
        if (!["proc", "falta"].includes(p.estado)) return false;
      } else if (p.estado !== filtroEstado) return false;
    }
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      p.nombre?.toLowerCase().includes(term) ||
      p.rut?.toLowerCase().includes(term) ||
      p.cargo?.toLowerCase().includes(term)
    );
  });

  // Listado maestro: cuántos contratos tiene asignados cada RUT único.
  const registrosPorRut = new Map<string, number>();
  for (const p of personalList) {
    if (p.rut) registrosPorRut.set(p.rut, (registrosPorRut.get(p.rut) || 0) + 1);
  }

  const total = personalList.length;
  const acreditados = personalList.filter((p) => p.estado === "ok").length;
  const pendientes = personalList.filter((p) => p.estado === "proc" || p.estado === "falta").length;
  const vencidos = personalList.filter((p) => p.estado === "venc").length;
  const etiquetaFiltro = filtroEstado === "pendiente" ? "Pendientes"
    : filtroEstado === "ok" ? "Acreditados"
    : filtroEstado === "venc" ? "Vencidos"
    : filtroEstado === "falta" ? "Pendientes"
    : filtroEstado === "proc" ? "En proceso"
    : filtroEstado === "baja" ? "Inactivos"
    : "";

  return (
    <div className="p-6 space-y-6">
      {/* Header único (título en AppHeader) */}
      <div className="flex flex-col md:flex-row md:justify-end gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setExportando(true)} className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
            ↓ Exportar
          </button>
          <button onClick={handleOpenNuevo} className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            + Agregar personal
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="text-2xl p-2 bg-slate-100 rounded-lg">👥</div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total personal</div>
            <div className="text-xl font-bold text-slate-800">{loading ? "..." : total}</div>
            <div className="text-[11px] text-slate-400">en tu empresa</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="text-2xl p-2 bg-emerald-50 rounded-lg text-emerald-600">✅</div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Acreditados</div>
            <div className="text-xl font-bold text-slate-800">{loading ? "..." : acreditados}</div>
            <div className="text-[11px] text-emerald-600 font-medium">
              {total > 0 ? `${Math.round((acreditados / total) * 100)}% del total` : "0% del total"}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="text-2xl p-2 bg-amber-50 rounded-lg text-amber-600">⏳</div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Pendientes</div>
            <div className="text-xl font-bold text-slate-800">{loading ? "..." : pendientes}</div>
            <div className="text-[11px] text-amber-600 font-medium">
              {total > 0 ? `${Math.round((pendientes / total) * 100)}% del total` : "0% del total"}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="text-2xl p-2 bg-red-50 rounded-lg text-red-600">❌</div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Vencidos</div>
            <div className="text-xl font-bold text-slate-800">{loading ? "..." : vencidos}</div>
            <div className="text-[11px] text-red-600 font-medium">
              {total > 0 ? `${Math.round((vencidos / total) * 100)}% del total` : "0% del total"}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State Banner */}
      {!loading && total === 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Sin datos de personal en la base de datos</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              No se encontraron trabajadores registrados actualmente en la base de datos.
              Puedes hacer clic en <b>"+ Agregar personal"</b> para registrar trabajadores.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, RUT o cargo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {filtroEstado && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Filtrando: <b>{etiquetaFiltro}</b> ({filtered.length})</span>
            <button
              onClick={() => setFiltroEstado("")}
              className="font-semibold text-blue-600 hover:text-blue-800"
            >
              Quitar filtro
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Trabajador</th>
              <th className="p-3.5">RUT</th>
              <th className="p-3.5">Cargo</th>
              <th className="p-3.5">Contratos</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Cargando registros de personal...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No se encontraron trabajadores registrados.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3.5 font-bold text-slate-800">{p.nombre}</td>
                  <td className="p-3.5 text-slate-500">{p.rut || "Sin RUT"}</td>
                  <td className="p-3.5 text-slate-700">{p.cargo || "Sin cargo"}</td>
                  <td className="p-3.5">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-600">
                      {p.rut ? `${registrosPorRut.get(p.rut) || 1} contrato${(registrosPorRut.get(p.rut) || 1) === 1 ? "" : "s"}` : "—"}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        p.estado === "ok"
                          ? "bg-emerald-100 text-emerald-800"
                          : p.estado === "proc"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {p.estado === "ok" ? "Acreditado" : p.estado === "proc" ? "En proceso" : "Pendiente/Vencido"}
                    </span>
                  </td>
                  <td className="p-3.5 text-right flex items-center justify-end gap-2">
                    <button onClick={() => handleOpenEditar(p)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Editar">
                      ✏️
                    </button>
                    <button onClick={() => handleEliminar(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Eliminar">
                      🗑️
                    </button>
                    <Link href={`/personal/${p.id}`} className="text-blue-600 hover:underline font-medium text-[10px] ml-2 border-l border-slate-200 pl-2">
                      Ver ficha →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">{isEditing ? "Editar Trabajador" : "Agregar Trabajador"}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="rut_root" className="block text-xs font-semibold text-slate-700 mb-1">RUT *</label>
                <input
                  id="rut_root"
                  type="text"
                  aria-invalid={!!errorRut || undefined}
                  aria-describedby={errorRut ? "rut_root_error" : undefined}
                  value={rut}
                  onChange={(e) => { setErrorRut(null); setRut(e.target.value); }}
                  disabled={isEditing}
                  placeholder="Ej. 19.112.466-9, 19112466-9 o 191124669"
                  className={`w-full p-2.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-2 ${errorRut ? "border-red-400 ring-1 ring-red-200" : "border-slate-300"} focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400`}
                />
                {errorRut && (
                  <p id="rut_root_error" role="alert" className="mt-1 text-[0.7rem] font-semibold text-red-600">
                    ⚠ {errorRut}
                  </p>
                )}
                {errorForm && (
                  <p role="alert" className="mt-1 text-[0.7rem] font-semibold text-red-600">⚠ {errorForm}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cargo (Opcional)</label>
                <input 
                  type="text" 
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ej: Conductor, Operador, etc."
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estado</label>
                <select 
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="proc">Pendiente</option>
                  <option value="ok">Activo (Acreditado)</option>
                  <option value="baja">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
              >
                Cancelar
              </button>
              <button 
                onClick={handleGuardar}
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExportarDocumentosModal
        abierto={exportando}
        onCerrar={() => setExportando(false)}
      />
    </div>
  );
}

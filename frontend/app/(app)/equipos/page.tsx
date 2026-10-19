"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import * as Api from "@/lib/cliente";
import type { Sujeto } from "@/lib/tipos";

export default function EquiposPage() {
  const [loading, setLoading] = useState(true);
  const [equiposList, setEquiposList] = useState<Sujeto[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchEquipos() {
      setLoading(true);
      try {
        const res = await Api.equipos.listar({ page_size: 50 });
        setEquiposList(res.items || []);
      } catch (err) {
        console.error("Error al cargar equipos:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchEquipos();
  }, []);

  const filtered = equiposList.filter((eq) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      eq.nombre?.toLowerCase().includes(term) ||
      eq.patente?.toLowerCase().includes(term) ||
      eq.tipo_equipo?.toLowerCase().includes(term)
    );
  });

  const total = equiposList.length;
  const acreditados = equiposList.filter((e) => e.estado === "ok").length;
  const pendientes = equiposList.filter((e) => e.estado === "proc" || e.estado === "falta").length;
  const vencidos = equiposList.filter((e) => e.estado === "venc").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header único (título en AppHeader) */}
      <div className="flex flex-col md:flex-row md:justify-end gap-4">
        <div className="flex items-center gap-3">
          <button className="px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">
            ↓ Exportar
          </button>
          <button className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            + Agregar equipo
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
          <div className="text-2xl p-2 bg-slate-100 rounded-lg">🚛</div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Total equipos</div>
            <div className="text-xl font-bold text-slate-800">{loading ? "..." : total}</div>
            <div className="text-[11px] text-slate-400">en tu flota</div>
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
            <h4 className="font-bold text-sm">Sin datos de equipos en la base de datos</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              No se encontraron equipos o vehículos registrados actualmente en la base de datos.
              Los datos estáticos de demostración fueron removidos. Puedes hacer clic en <b>"+ Agregar equipo"</b> para registrar maquinaria.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3">
        <input
          type="text"
          placeholder="Buscar por patente, marca o tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Equipo / Nombre</th>
              <th className="p-3.5">Patente</th>
              <th className="p-3.5">Tipo</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Cargando registros de equipos...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  No se encontraron equipos registrados en la base de datos.
                </td>
              </tr>
            ) : (
              filtered.map((eq) => (
                <tr key={eq.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-3.5 font-bold text-slate-800">{eq.nombre}</td>
                  <td className="p-3.5 text-slate-500">{eq.patente || "Sin patente"}</td>
                  <td className="p-3.5 text-slate-700">{eq.tipo_equipo || "Maquinaria"}</td>
                  <td className="p-3.5">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        eq.estado === "ok"
                          ? "bg-emerald-100 text-emerald-800"
                          : eq.estado === "proc"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {eq.estado === "ok" ? "Acreditado" : eq.estado === "proc" ? "En proceso" : "Pendiente/Vencido"}
                    </span>
                  </td>
                  <td className="p-3.5 text-right">
                    <Link href={`/equipos/${eq.id}`} className="text-blue-600 hover:underline font-medium">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

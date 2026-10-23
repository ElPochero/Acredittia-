"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { Integracion } from "@/lib/tipos";

export default function IntegracionesPage() {
  const [loading, setLoading] = useState(true);
  const [integracionesList, setIntegracionesList] = useState<Integracion[]>([]);

  useEffect(() => {
    async function fetchIntegraciones() {
      setLoading(true);
      try {
        const res = await Api.integraciones.listar({ page_size: 50 });
        setIntegracionesList(res.items || []);
      } catch (err) {
        console.error("Error al cargar integraciones:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchIntegraciones();
  }, []);

  const total = integracionesList.length;

  return (
    <div className="p-6 space-y-6">
      {/* Título único en AppHeader; sin cabecera duplicada */}

      {!loading && total === 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Sin integraciones activas en la base de datos</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              No se encontraron credenciales o integraciones configuradas en la base de datos de tu organización.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Plataforma / Sistema</th>
              <th className="p-3.5">Tipo</th>
              <th className="p-3.5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400">
                  Cargando integraciones...
                </td>
              </tr>
            ) : integracionesList.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400">
                  No hay integraciones configuradas en la base de datos.
                </td>
              </tr>
            ) : (
              integracionesList.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/50">
                  <td className="p-3.5 font-bold text-slate-800">{i.tipo}</td>
                  <td className="p-3.5 text-slate-600">Integración API</td>
                  <td className="p-3.5 text-emerald-600 font-medium">{i.estado}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

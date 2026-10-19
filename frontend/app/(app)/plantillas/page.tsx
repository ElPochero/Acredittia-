"use client";

import React, { useEffect, useState } from "react";
import * as Api from "@/lib/cliente";
import type { PlantillaRequisito } from "@/lib/tipos";

export default function PlantillasPage() {
  const [loading, setLoading] = useState(true);
  const [plantillasList, setPlantillasList] = useState<PlantillaRequisito[]>([]);

  useEffect(() => {
    async function fetchPlantillas() {
      setLoading(true);
      try {
        const res = await Api.requisitos.plantillas({ page_size: 50 });
        setPlantillasList(res.items || []);
      } catch (err) {
        console.error("Error al cargar plantillas:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlantillas();
  }, []);

  const total = plantillasList.length;

  return (
    <div className="p-6 space-y-6">
      {/* Título único en AppHeader; sin cabecera duplicada */}

      {!loading && total === 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-4 flex items-start gap-3 shadow-sm">
          <span className="text-xl">⚠️</span>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Sin datos de plantillas en la base de datos</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              No se encontraron plantillas registradas actualmente en la base de datos.
            </p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Título</th>
              <th className="p-3.5">Ámbito</th>
              <th className="p-3.5">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400">
                  Cargando plantillas...
                </td>
              </tr>
            ) : plantillasList.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-400">
                  No hay plantillas registradas en la base de datos.
                </td>
              </tr>
            ) : (
              plantillasList.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="p-3.5 font-bold text-slate-800">{p.titulo}</td>
                  <td className="p-3.5 text-slate-600">{p.ambito || "General"}</td>
                  <td className="p-3.5 text-slate-500">{p.tipo || "Documento"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

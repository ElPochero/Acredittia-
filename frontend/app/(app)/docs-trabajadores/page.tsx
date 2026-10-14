"use client";
import { useState, useEffect } from "react";
import * as Api from "@/lib/cliente";
import type { Sujeto, PlantillaRequisito } from "@/lib/tipos";

function SearchableSelect({ options, value, onChange, placeholder, disabled }: { 
  options: {value: string, label: string}[], 
  value: string, 
  onChange: (val: string) => void, 
  placeholder: string,
  disabled?: boolean
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const selected = options.find(o => o.value === value);
    if (selected) setSearch(selected.label);
    else if (!open) setSearch(""); // Solo limpiar si el dropdown no está abierto
  }, [value, options, open]);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          if (value) onChange(""); // clear value while searching
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        disabled={disabled}
        className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
      />
      {open && !disabled && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="p-2.5 text-xs text-slate-500">No hay resultados</li>
          ) : (
            filtered.map(o => (
              <li
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setSearch(o.label);
                  setOpen(false);
                }}
                className="p-2.5 text-xs text-slate-700 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0"
              >
                {o.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function DocsTrabajadoresPage() {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [trabajadores, setTrabajadores] = useState<Sujeto[]>([]);
  const [selectedTrabajador, setSelectedTrabajador] = useState("");
  const [selectedPlantilla, setSelectedPlantilla] = useState("");
  const [plantillas, setPlantillas] = useState<PlantillaRequisito[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    if (modalAbierto && trabajadores.length === 0) {
      const fetchOpciones = async () => {
        setLoadingModal(true);
        try {
          const [resTrabajadores, resPlantillas] = await Promise.all([
            Api.personal.listar({ page_size: 100 }),
            Api.requisitos.plantillas({ page_size: 100, ambito: "personal" })
          ]);
          setTrabajadores(resTrabajadores.items || []);
          setPlantillas(resPlantillas.items || []);
        } catch (error) {
          console.error("Error cargando opciones:", error);
        } finally {
          setLoadingModal(false);
        }
      };
      fetchOpciones();
    }
  }, [modalAbierto, trabajadores.length]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Documentación de Trabajadores
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sube y gestiona los contratos y acreditaciones del personal, definiendo su vigencia.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setModalAbierto(true)}
            className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            + Subir Documentos
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Trabajador</th>
              <th className="p-3.5">Documento / Plantilla</th>
              <th className="p-3.5">Vigencia Asignada</th>
              <th className="p-3.5">Fecha Vencimiento</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <td colSpan={6} className="p-8 text-center">
                <div className="text-4xl mb-3">📁</div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">No hay documentos</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Aún no has subido documentación para el personal. Haz clic en el botón superior para comenzar.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Subir Documentación de Trabajador</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seleccionar Trabajador</label>
                <SearchableSelect
                  placeholder={loadingModal ? "Cargando..." : "Buscar trabajador..."}
                  disabled={loadingModal}
                  options={trabajadores.map(t => ({ value: t.id, label: t.nombre || "" }))}
                  value={selectedTrabajador}
                  onChange={setSelectedTrabajador}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plantilla / Tipo de Documento</label>
                <SearchableSelect
                  placeholder={loadingModal ? "Cargando..." : "Buscar plantilla..."}
                  disabled={loadingModal}
                  options={plantillas.map(p => ({ value: (p as any).template_id || p.id, label: p.titulo || "" }))}
                  value={selectedPlantilla}
                  onChange={setSelectedPlantilla}
                />
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <label className="block text-xs font-bold text-blue-900 mb-2">Vigencia del Documento</label>
                <div className="flex gap-3">
                  <input type="number" placeholder="Ej: 1, 6, 12..." className="w-1/3 p-2.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <select className="w-2/3 p-2.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="dias">Días</option>
                    <option value="semanas">Semanas</option>
                    <option value="meses">Meses</option>
                    <option value="anos">Años</option>
                    <option value="indefinido">Indefinido</option>
                  </select>
                </div>
                <p className="text-[10px] text-blue-700 mt-2 font-medium">La fecha de vencimiento se calculará automáticamente en base a esto.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Archivo PDF</label>
                <input type="file" accept=".pdf" className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg border-dashed text-slate-600" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => setModalAbierto(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                Guardar y Subir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

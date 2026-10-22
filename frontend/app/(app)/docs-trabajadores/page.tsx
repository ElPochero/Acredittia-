"use client";
/**
 * Documentación de trabajadores (H-27).
 *
 * El flujo de subida es el de tres pasos del backend: `POST
 * /documentos/{id}/upload-url` (SAS), `PUT` del binario contra esa URL y
 * `POST /documentos/{id}/archivos` para confirmar el registro. El cliente ya
 * lo tiene en `Api.subirDocumento`; aquí solo se orquesta, con barra de
 * progreso y avisos.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as Api from "@/lib/cliente";
import type { Documento, DocumentoFila, Sujeto } from "@/lib/tipos";
import { Barra, Chip, Modal, Spinner, Stepper } from "@/components/ui";

/** Extensiones que acepta el backend (`ALLOWED_EXTENSIONS`). */
const EXTENSIONES = [".pdf", ".jpg", ".jpeg", ".png"];
const MAX_MB = 20;

type Unidad = "dias" | "semanas" | "meses" | "anos" | "indefinido";

const UNIDADES: { valor: Unidad; etiqueta: string }[] = [
  { valor: "dias", etiqueta: "Días" },
  { valor: "semanas", etiqueta: "Semanas" },
  { valor: "meses", etiqueta: "Meses" },
  { valor: "anos", etiqueta: "Años" },
  { valor: "indefinido", etiqueta: "Indefinido" },
];

/** Suma `n` unidades a hoy. Meses y años se approximates a 30/365 días. */
function calcularVencimiento(numero: number, unidad: Unidad): string | null {
  if (unidad === "indefinido" || numero <= 0) return null;
  const dias =
    unidad === "dias" ? numero
    : unidad === "semanas" ? numero * 7
    : unidad === "meses" ? numero * 30
    : numero * 365;
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CL");
}

function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i < 0 ? "" : nombre.slice(i).toLowerCase();
}

function SelectBuscable({
  opciones,
  valor,
  onChange,
  placeholder,
  disabled,
}: {
  opciones: { value: string; label: string }[];
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const sel = opciones.find((o) => o.value === valor);

  useEffect(() => {
    if (sel) setBusqueda(sel.label);
    // Solo se limpia con el desplegable cerrado: si no, el texto que el
    // usuario está escribiendo se borraría en cada tecla.
    else if (!abierto) setBusqueda("");
  }, [valor, opciones, abierto]);

  const filtradas = opciones.filter((o) =>
    o.label.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder={placeholder}
        value={busqueda}
        disabled={disabled}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setAbierto(true);
          if (valor) onChange("");
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
      />
      {abierto && !disabled && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtradas.length === 0 ? (
            <li className="p-2.5 text-xs text-slate-500">No hay resultados</li>
          ) : (
            filtradas.map((o) => (
              <li
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setBusqueda(o.label);
                  setAbierto(false);
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
  const [filas, setFilas] = useState<DocumentoFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [trabajadores, setTrabajadores] = useState<Sujeto[]>([]);
  const [selectedTrabajador, setSelectedTrabajador] = useState("");
  const [checklist, setChecklist] = useState<Documento[]>([]);
  const [selectedDocumento, setSelectedDocumento] = useState("");
  const [vigencia, setVigencia] = useState(12);
  const [unidad, setUnidad] = useState<Unidad>("meses");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [cargandoModal, setCargandoModal] = useState(false);
  const [cargandoChecklist, setCargandoChecklist] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [pct, setPct] = useState(0);
  const [etapa, setEtapa] = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await Api.documentos.listar({ page_size: 100 });
      setFilas(res.items || []);
    } catch (e) {
      toast.error("No se pudo cargar la documentación", {
        description: Api.mensajeError(e),
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!modalAbierto || trabajadores.length > 0) return;
    setCargandoModal(true);
    Api.personal
      .listar({ page_size: 100 })
      .then((res) => setTrabajadores(res.items || []))
      .catch((e) =>
        toast.error("No se pudieron cargar los trabajadores", {
          description: Api.mensajeError(e),
        }),
      )
      .finally(() => setCargandoModal(false));
  }, [modalAbierto, trabajadores.length]);

  // El checklist del trabajador elegido es la lista de requisitos donde se
  // puede subir el archivo: la SAS se emite contra un documento, no contra un
  // trabajador suelto.
  useEffect(() => {
    if (!selectedTrabajador) {
      setChecklist([]);
      return;
    }
    let vivo = true;
    setCargandoChecklist(true);
    // La selección se revalida cuando llega el checklist del trabajador.
    Api.personal
      .documentos(selectedTrabajador)
      .then((res) => {
        if (!vivo) return;
        const items = res.items || [];
        setChecklist(items);
        // Si el documento precargado sigue en el checklist, se conserva.
        setSelectedDocumento((prev) =>
          prev && items.some((d) => d.id === prev) ? prev : "",
        );
      })
      .catch((e) => {
        if (vivo)
          toast.error("No se pudo cargar el checklist", {
            description: Api.mensajeError(e),
          });
      })
      .finally(() => {
        if (vivo) setCargandoChecklist(false);
      });
    return () => {
      vivo = false;
    };
  }, [selectedTrabajador]);

  const visibles = useMemo(() => {
    // Solo el personal: este módulo es la documentación de los trabajadores.
    const q = busqueda.trim().toLowerCase();
    const delPersonal = filas.filter((f) => f.dueno?.tipo === "trabajador");
    if (!q) return delPersonal;
    return delPersonal.filter(
      (f) =>
        (f.dueno?.nombre ?? "").toLowerCase().includes(q) ||
        f.titulo.toLowerCase().includes(q),
    );
  }, [filas, busqueda]);

  const cerrar = () => {
    if (subiendo) return;
    setModalAbierto(false);
    setSelectedTrabajador("");
    setSelectedDocumento("");
    setArchivo(null);
    setSubiendo(false);
    setPct(0);
  };

  const validarArchivo = (f: File): string | null => {
    if (!EXTENSIONES.includes(extensionDe(f.name)))
      return `Formato no permitido. Se aceptan ${EXTENSIONES.join(", ")}.`;
    if (f.size > MAX_MB * 1024 * 1024)
      return `El archivo supera el máximo de ${MAX_MB} MB.`;
    return null;
  };

  const guardar = async () => {
    if (!selectedDocumento || !archivo || subiendo) return;
    const problema = validarArchivo(archivo);
    if (problema) {
      toast.error("Archivo inválido", { description: problema });
      return;
    }

    setSubiendo(true);
    setPct(0);
    setEtapa("Preparando la subida…");
    try {
      const vence = calcularVencimiento(vigencia, unidad);
      if (vence) await Api.documentos.editar(selectedDocumento, { vence });

      await Api.subirDocumento(selectedDocumento, archivo, (p, e) => {
        setPct(p);
        setEtapa(
          e === "firmando"
            ? "Preparando la subida…"
            : e === "subiendo"
              ? "Subiendo el archivo…"
              : e === "confirmando"
                ? "Registrando el archivo…"
                : "Listo",
        );
      });

      toast.success("Documento subido", {
        description: `${archivo.name} quedó registrado en el expediente.`,
      });
      cerrar();
      await cargar();
    } catch (e) {
      toast.error("No se pudo subir el documento", {
        description: Api.mensajeError(e),
      });
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por trabajador o documento..."
          className="w-full md:max-w-sm px-3.5 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
        />
        <span className="text-xs text-slate-500">
          {visibles.length} documento(s) del personal
        </span>
        <button
          onClick={() => setModalAbierto(true)}
          className="px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
        >
          + Subir Documentos
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="p-3.5">Trabajador</th>
              <th className="p-3.5">Documento / Plantilla</th>
              <th className="p-3.5">Fecha Vencimiento</th>
              <th className="p-3.5">Días restantes</th>
              <th className="p-3.5">Estado</th>
              <th className="p-3.5 text-center">Archivos</th>
              <th className="p-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr>
                <td colSpan={7} className="p-8">
                  <Spinner texto="Cargando documentación..." />
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center">
                  <div className="text-4xl mb-3">📁</div>
                  <h3 className="text-sm font-bold text-slate-800 mb-1">
                    No hay documentos
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Aún no has subido documentación para el personal. Haz clic en
                    el botón superior para comenzar.
                  </p>
                </td>
              </tr>
            ) : (
              visibles.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5 font-semibold text-slate-800">
                    {f.dueno?.nombre ?? "—"}
                  </td>
                  <td className="p-3.5 text-slate-600">{f.titulo}</td>
                  <td className="p-3.5 text-slate-600">
                    {formatFecha(f.vence)}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    {f.dias_para_vencer ?? "—"}
                  </td>
                  <td className="p-3.5">
                    <Chip estado={f.estado_calc} />
                  </td>
                  <td className="p-3.5 text-center font-bold text-slate-700">
                    {f.archivos_count}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => {
                        setSelectedTrabajador(f.dueno?.id ?? "");
                        setSelectedDocumento(f.id);
                        setModalAbierto(true);
                      }}
                      className="px-2.5 py-1 text-[0.7rem] font-bold text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors"
                    >
                      📎 Subir archivo
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={modalAbierto}
        titulo="Subir Documentación de Trabajador"
        onCerrar={cerrar}
        ancho="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Seleccionar Trabajador
            </label>
            <SelectBuscable
              placeholder={cargandoModal ? "Cargando..." : "Buscar trabajador..."}
              disabled={cargandoModal || subiendo}
              opciones={trabajadores.map((t) => ({
                value: t.id,
                label: t.nombre || "",
              }))}
              valor={selectedTrabajador}
              onChange={setSelectedTrabajador}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Documento / Requisito
            </label>
            <SelectBuscable
              placeholder={
                !selectedTrabajador
                  ? "Elige un trabajador primero..."
                  : cargandoChecklist
                    ? "Cargando..."
                    : checklist.length === 0
                      ? "Este trabajador no tiene requisitos"
                      : "Buscar requisito..."
              }
              disabled={
                subiendo || !selectedTrabajador || cargandoChecklist ||
                checklist.length === 0
              }
              opciones={checklist.map((d) => ({ value: d.id, label: d.titulo }))}
              valor={selectedDocumento}
              onChange={setSelectedDocumento}
            />
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <label className="block text-xs font-bold text-blue-900 mb-2">
              Vigencia del Documento
            </label>
            <div className="flex items-center gap-3">
              <Stepper
                valor={vigencia}
                onChange={setVigencia}
                min={0}
                disabled={subiendo}
                etiqueta="Vigencia en meses"
              />
              <select
                value={unidad}
                disabled={subiendo}
                onChange={(e) => setUnidad(e.target.value as Unidad)}
                className="h-[38px] flex-1 px-2.5 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {UNIDADES.map((u) => (
                  <option key={u.valor} value={u.valor}>
                    {u.etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-blue-700 mt-2 font-medium">
              {unidad === "indefinido"
                ? "El documento quedará sin fecha de vencimiento."
                : `Vence el ${formatFecha(calcularVencimiento(vigencia, unidad))}.`}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Archivo (PDF, JPG o PNG · máx. {MAX_MB} MB)
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={subiendo}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setArchivo(f);
                e.target.value = "";
              }}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg border-dashed text-slate-600 disabled:opacity-60"
            />
            {archivo && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                {archivo.name} · {(archivo.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          {subiendo && (
            <div role="status" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <Barra pct={pct} texto={etapa} />
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            onClick={cerrar}
            disabled={subiendo}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={subiendo || !selectedDocumento || !archivo}
            className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {subiendo ? "Subiendo…" : "Guardar y Subir"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

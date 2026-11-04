"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal, Spinner } from "@/components/shared/ui";
import * as Api from "@/lib/platform/cliente";
import type { Contrato, TrabajadorIn, EquipoIn } from "@/lib/platform/tipos";
import { normalizarRut, validarRut } from "@/lib/platform/rut";

export interface AgregarSujetosModalProps {
  cat: "personal" | "equipo";
  abierto: boolean;
  onCerrar: () => void;
  onGuardado?: () => void;
  contratoIdInicial?: string | null;
}

interface RowPersonal {
  on: boolean;
  nombre: string;
  rut: string;
  cargo: string;
  telefono: string;
  email: string;
}

interface RowEquipo {
  on: boolean;
  patente: string;
  tipo_equipo: string;
  marca: string;
  modelo: string;
  anio: string;
}

interface ChatMsg {
  remitente: "bot" | "user";
  texto?: string;
  archivo?: string;
  esImagen?: boolean;
}

const TIPOS_EQUIPO = [
  "Camión",
  "Tracto-Camión",
  "Camioneta",
  "Furgón",
  "Bus",
  "Minibús",
  "Semirremolque",
  "Grúa",
  "Grúa Horquilla",
  "Retroexcavadora",
  "Motoniveladora",
  "Equipo de levante",
  "Equipo de producción",
  "Otro",
];

const CARGOS_SUGERIDOS = [
  "Operador Camión Tolva",
  "Conductor Tracto-camión",
  "Conductor de Faena",
  "Mecánico de Camiones",
  "Prevencionista de Riesgos",
  "Administrador de Contrato",
  "Supervisor de Operaciones",
  "Jornal",
  "Eléctrico",
  "Rigger",
];

export function AgregarSujetosModal({
  cat,
  abierto,
  onCerrar,
  onGuardado,
  contratoIdInicial = null,
}: AgregarSujetosModalProps) {
  const esPersonal = cat === "personal";

  // Modo formulario vs chat IA
  const [modo, setModo] = useState<"form" | "chat">("form");

  // Contratos disponibles
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [contratoId, setContratoId] = useState<string>(contratoIdInicial || "");

  // Estado del Formulario Personal
  const [nombre, setNombre] = useState("");
  const [rut, setRut] = useState("");
  const [cargo, setCargo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [masDatos, setMasDatos] = useState(false);
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [centroCosto, setCentroCosto] = useState("");
  const [licencia, setLicencia] = useState("");
  const [contactoEmergencia, setContactoEmergencia] = useState("");
  const [esConductor, setEsConductor] = useState(false);

  // Estado del Formulario Equipo
  const [patente, setPatente] = useState("");
  const [tipoEquipo, setTipoEquipo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [vin, setVin] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [km, setKm] = useState("");
  const [propietario, setPropietario] = useState("");

  // Estado de errores y guardado
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [errorRut, setErrorRut] = useState<string | null>(null);

  // Estado de Chat IA y Carga Masiva
  const [mensajes, setMensajes] = useState<ChatMsg[]>([]);
  const [textoChat, setTextoChat] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowsPersonal, setRowsPersonal] = useState<RowPersonal[]>([]);
  const [rowsEquipos, setRowsEquipos] = useState<RowEquipo[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Cargar contratos al abrir
  useEffect(() => {
    if (!abierto) return;
    Api.contratos
      .listar({ page_size: 100 })
      .then((res) => {
        setContratos(res.items || []);
        if (contratoIdInicial) {
          setContratoId(contratoIdInicial);
        } else if (res.items && res.items.length > 0) {
          setContratoId(res.items[0].id);
        }
      })
      .catch((err) => console.error("Error al cargar contratos:", err));
  }, [abierto, contratoIdInicial]);

  // Mensaje inicial del bot
  useEffect(() => {
    if (!abierto) return;
    const msgInit: ChatMsg = {
      remitente: "bot",
      texto: esPersonal
        ? "Hola 👋 Súbeme un Excel o un pantallazo con tu personal (por ejemplo la nómina o un listado), o pégame los datos aquí. Yo leo nombre, RUT, cargo, teléfono y correo, y te los dejo listos para agregar."
        : "Hola 👋 Súbeme un Excel o un pantallazo con tus equipos y vehículos (patente, tipo, marca, modelo, año) o pégalos aquí, y los dejo listos para agregar.",
    };
    setMensajes([msgInit]);
    setRowsPersonal([]);
    setRowsEquipos([]);
    setErrorForm(null);
    setErrorRut(null);
  }, [abierto, esPersonal]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [mensajes, busy]);

  const showToast = (msg: string) => {
    if (typeof window !== "undefined" && (window as any).toast) {
      (window as any).toast(msg);
    }
  };

  // Formatear RUT inline
  const handleRutChange = (val: string) => {
    let clean = val.replace(/[^0-9kK]/g, "").toUpperCase();
    if (clean.length < 2) {
      setRut(clean);
      return;
    }
    const dv = clean.slice(-1);
    const num = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setRut(`${num}-${dv}`);
  };

  // Guardar formulario individual
  const handleGuardarForm = async () => {
    setErrorForm(null);
    setErrorRut(null);

    if (esPersonal) {
      if (!nombre.trim() || !rut.trim() || !cargo.trim()) {
        setErrorForm("Completa nombre, RUT y cargo");
        return;
      }
      if (!validarRut(rut)) {
        setErrorRut("RUT inválido. Debe cumplir con formato chileno válido");
        return;
      }
      const rutNorm = normalizarRut(rut) || rut.trim();

      setGuardando(true);
      try {
        await Api.personal.crear({
          contrato_id: contratoId || null,
          nombre: nombre.trim(),
          rut: rutNorm,
          cargo: cargo.trim(),
          telefono: telefono.trim() || null,
          email: email.trim() || null,
          es_conductor: esConductor,
        });
        showToast(
          `Trabajador agregado${contratoId ? " al contrato con sus requisitos" : " al listado de la empresa"}`
        );
        onGuardado?.();
        onCerrar();
      } catch (e: any) {
        if (e.code === "RUT_DUPLICADO") {
          setErrorRut("Ya existe un trabajador con ese RUT");
        } else {
          setErrorForm(e.message || "Error al agregar trabajador");
        }
      } finally {
        setGuardando(false);
      }
    } else {
      // Equipos: Patente es el ÚNICO campo obligatorio
      if (!patente.trim()) {
        setErrorForm("La patente es obligatoria");
        return;
      }
      const patNorm = patente.trim().toUpperCase();

      setGuardando(true);
      try {
        await Api.equipos.crear({
          contrato_id: contratoId || null,
          patente: patNorm,
          tipo_equipo: tipoEquipo.trim() || "Otro",
          marca: marca.trim() || null,
          modelo: modelo.trim() || null,
          anio: anio ? parseInt(String(anio), 10) : null,
        });
        showToast(
          `Equipo agregado${contratoId ? " al contrato con sus requisitos" : " al listado de la empresa"}`
        );
        onGuardado?.();
        onCerrar();
      } catch (e: any) {
        if (e.code === "PATENTE_DUPLICADA") {
          setErrorForm("Esa patente ya está activa en este contrato o empresa");
        } else {
          setErrorForm(e.message || "Error al agregar equipo");
        }
      } finally {
        setGuardando(false);
      }
    }
  };

  // Procesar archivo adjunto en chat
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith("image/");
    const reader = new FileReader();

    reader.onload = async () => {
      const b64 = reader.result as string;
      setMensajes((prev) => [
        ...prev,
        {
          remitente: "user",
          archivo: file.name,
          esImagen: isImg,
        },
      ]);
      setBusy(true);

      try {
        const res = await Api.ia.extraerListado({
          tipo: cat,
          file_b64: b64,
          file_name: file.name,
        });

        const items = res.items || [];
        if (esPersonal) {
          const nuevas = items.map((it: any) => ({
            on: true,
            nombre: it.nombre || "",
            rut: it.rut || "",
            cargo: it.cargo || "",
            telefono: it.telefono || it.tel || "",
            email: it.email || it.mail || "",
          }));
          setRowsPersonal((prev) => [...prev, ...nuevas]);
        } else {
          const nuevas = items.map((it: any) => ({
            on: true,
            patente: (it.patente || it.pat || "").toUpperCase(),
            tipo_equipo: it.tipo_equipo || it.tipo || "Otro",
            marca: it.marca || "",
            modelo: it.modelo || "",
            anio: it.anio ? String(it.anio) : "",
          }));
          setRowsEquipos((prev) => [...prev, ...nuevas]);
        }

        setMensajes((prev) => [
          ...prev,
          {
            remitente: "bot",
            texto: `Listo, leí <b>${file.name}</b> y encontré <b>${items.length} ${esPersonal ? "trabajadores" : "equipos"}</b>. Revísalos abajo: puedes corregir cualquier dato, desmarcar los que no quieras y elegir a qué contrato asignarlos.`,
          },
        ]);
      } catch (err: any) {
        setMensajes((prev) => [
          ...prev,
          {
            remitente: "bot",
            texto: `Ocurrió un error al procesar el archivo: ${err.message || "Error desconocido"}`,
          },
        ]);
      } finally {
        setBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsDataURL(file);
  };

  // Enviar texto libre pegado
  const handleEnviarTexto = async () => {
    const t = textoChat.trim();
    if (!t) return;

    setMensajes((prev) => [...prev, { remitente: "user", texto: t }]);
    setTextoChat("");
    setBusy(true);

    try {
      const res = await Api.ia.extraerListado({
        tipo: cat,
        texto: t,
      });

      const items = res.items || [];
      if (esPersonal) {
        const nuevas = items.map((it: any) => ({
          on: true,
          nombre: it.nombre || "",
          rut: it.rut || "",
          cargo: it.cargo || "",
          telefono: it.telefono || it.tel || "",
          email: it.email || it.mail || "",
        }));
        setRowsPersonal((prev) => [...prev, ...nuevas]);
      } else {
        const nuevas = items.map((it: any) => ({
          on: true,
          patente: (it.patente || it.pat || "").toUpperCase(),
          tipo_equipo: it.tipo_equipo || it.tipo || "Otro",
          marca: it.marca || "",
          modelo: it.modelo || "",
          anio: it.anio ? String(it.anio) : "",
        }));
        setRowsEquipos((prev) => [...prev, ...nuevas]);
      }

      setMensajes((prev) => [
        ...prev,
        {
          remitente: "bot",
          texto: `Agregué <b>${items.length}</b> a la lista. Revísalos abajo y presiona Guardar.`,
        },
      ]);
    } catch (err: any) {
      setMensajes((prev) => [
        ...prev,
        {
          remitente: "bot",
          texto: `Error al procesar el texto: ${err.message || "Error desconocido"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Guardar filas de carga masiva
  const handleGuardarBulk = async () => {
    if (esPersonal) {
      const seleccionados = rowsPersonal.filter((r) => r.on && r.nombre.trim() && r.rut.trim());
      if (seleccionados.length === 0) {
        alert("Selecciona al menos un trabajador válido para agregar");
        return;
      }
      setGuardando(true);
      try {
        const payload: TrabajadorIn[] = seleccionados.map((r) => ({
          contrato_id: contratoId || null,
          nombre: r.nombre.trim(),
          rut: normalizarRut(r.rut) || r.rut.trim(),
          cargo: r.cargo.trim() || "Trabajador",
          telefono: r.telefono.trim() || null,
          email: r.email.trim() || null,
        }));
        const res = await Api.personal.bulk(payload);
        showToast(
          `${res.creados} trabajadores agregados exitosamente${res.omitidos ? ` (${res.omitidos} omitidos por RUT duplicado)` : ""}`
        );
        onGuardado?.();
        onCerrar();
      } catch (err: any) {
        alert(err.message || "Error al guardar el lote de trabajadores");
      } finally {
        setGuardando(false);
      }
    } else {
      const seleccionados = rowsEquipos.filter((r) => r.on && r.patente.trim());
      if (seleccionados.length === 0) {
        alert("Selecciona al menos un equipo con patente para agregar");
        return;
      }
      setGuardando(true);
      try {
        const payload: EquipoIn[] = seleccionados.map((r) => ({
          contrato_id: contratoId || null,
          patente: r.patente.trim().toUpperCase(),
          tipo_equipo: r.tipo_equipo.trim() || "Otro",
          marca: r.marca.trim() || null,
          modelo: r.modelo.trim() || null,
          anio: r.anio ? parseInt(r.anio, 10) : null,
        }));
        const res = await Api.equipos.bulk(payload);
        showToast(
          `${res.creados} equipos agregados exitosamente${res.omitidos ? ` (${res.omitidos} omitidos por patente duplicada)` : ""}`
        );
        onGuardado?.();
        onCerrar();
      } catch (err: any) {
        alert(err.message || "Error al guardar el lote de equipos");
      } finally {
        setGuardando(false);
      }
    }
  };

  const totalSeleccionados = esPersonal
    ? rowsPersonal.filter((r) => r.on).length
    : rowsEquipos.filter((r) => r.on).length;

  return (
    <Modal
      abierto={abierto}
      titulo={`Agregar ${esPersonal ? "personal" : "equipos y vehículos"}`}
      onCerrar={onCerrar}
      ancho={modo === "chat" && (rowsPersonal.length > 0 || rowsEquipos.length > 0) ? "max-w-4xl" : "max-w-xl"}
    >
      <div className="text-[0.78rem] text-slate-500 mb-3">
        Agrégalos uno a uno con el formulario o carga varios de una vez con un Excel o un pantallazo.
      </div>

      {/* Conmutador .nc-modes */}
      <div className="flex border border-slate-200 bg-slate-100 rounded-lg p-1 mb-4">
        <button
          type="button"
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
            modo === "form" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setModo("form")}
        >
          ✍️ Formulario
        </button>
        <button
          type="button"
          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
            modo === "chat" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
          }`}
          onClick={() => setModo("chat")}
        >
          🤖 Cargar Excel o pantallazo
        </button>
      </div>

      {/* PESTAÑA 1: FORMULARIO */}
      {modo === "form" && (
        <div className="space-y-3.5">
          {errorForm && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg">
              {errorForm}
            </div>
          )}

          {esPersonal ? (
            <>
              <div>
                <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nombre completo *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Roberto Díaz Soto"
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    RUT *
                  </label>
                  <input
                    type="text"
                    value={rut}
                    onChange={(e) => handleRutChange(e.target.value)}
                    placeholder="12.345.678-9"
                    className={`w-full h-9 px-3 border rounded-lg text-xs focus:outline-none ${
                      errorRut ? "border-red-400 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                  {errorRut && <div className="text-[0.65rem] text-red-600 mt-1">{errorRut}</div>}
                </div>

                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Cargo *
                  </label>
                  <input
                    type="text"
                    list="cargos-sugeridos"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ej: Operador Camión Tolva"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                  <datalist id="cargos-sugeridos">
                    {CARGOS_SUGERIDOS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@correo.cl"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Desplegable Más datos (opcional) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setMasDatos(!masDatos)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                >
                  <span>{masDatos ? "▾" : "▸"}</span> Más datos (opcional)
                </button>

                {masDatos && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Fecha de ingreso
                        </label>
                        <input
                          type="date"
                          value={fechaIngreso}
                          onChange={(e) => setFechaIngreso(e.target.value)}
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Centro de costo / Área
                        </label>
                        <input
                          type="text"
                          value={centroCosto}
                          onChange={(e) => setCentroCosto(e.target.value)}
                          placeholder="Ej: Operaciones Norte"
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Licencia de conducir
                        </label>
                        <select
                          value={licencia}
                          onChange={(e) => setLicencia(e.target.value)}
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        >
                          <option value="">— Ninguna —</option>
                          <option value="A1">A1</option>
                          <option value="A2">A2</option>
                          <option value="A4">A4</option>
                          <option value="A5">A5</option>
                          <option value="B">B</option>
                          <option value="D">D</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Contacto de emergencia
                        </label>
                        <input
                          type="text"
                          value={contactoEmergencia}
                          onChange={(e) => setContactoEmergencia(e.target.value)}
                          placeholder="Nombre y teléfono"
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={esConductor}
                        onChange={(e) => setEsConductor(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 accent-blue-600"
                      />
                      <span className="text-xs text-slate-700 font-medium">
                        Conduce dentro de la faena (requiere licencia interna EMSIPOR)
                      </span>
                    </label>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Formulario Equipo */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Patente / código interno *
                  </label>
                  <input
                    type="text"
                    value={patente}
                    onChange={(e) => setPatente(e.target.value.toUpperCase())}
                    placeholder="ABCD-12"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs uppercase focus:outline-none focus:border-blue-500"
                  />
                  <div className="text-[0.65rem] text-slate-500 mt-0.5">Único campo obligatorio</div>
                </div>

                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Tipo de vehículo
                  </label>
                  <select
                    value={tipoEquipo}
                    onChange={(e) => setTipoEquipo(e.target.value)}
                    className="w-full h-9 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">— Selecciona (o por defecto Otro) —</option>
                    {TIPOS_EQUIPO.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Marca
                  </label>
                  <input
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ej: Volvo"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
                    Modelo
                  </label>
                  <input
                    type="text"
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ej: FMX 500"
                    className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Desplegable Más datos (opcional) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setMasDatos(!masDatos)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
                >
                  <span>{masDatos ? "▾" : "▸"}</span> Más datos (opcional)
                </button>

                {masDatos && (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Año
                        </label>
                        <input
                          type="number"
                          value={anio}
                          onChange={(e) => setAnio(e.target.value)}
                          placeholder="2022"
                          min={1980}
                          max={2035}
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          N° de chasis / VIN
                        </label>
                        <input
                          type="text"
                          value={vin}
                          onChange={(e) => setVin(e.target.value)}
                          placeholder="VIN de 17 caracteres"
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Capacidad
                        </label>
                        <input
                          type="text"
                          value={capacidad}
                          onChange={(e) => setCapacidad(e.target.value)}
                          placeholder="Ej: 20 m³ · 30 ton"
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                          Kilometraje / Horómetro
                        </label>
                        <input
                          type="text"
                          value={km}
                          onChange={(e) => setKm(e.target.value)}
                          placeholder="Ej: 45.000 km"
                          className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[0.68rem] font-bold text-slate-600 uppercase mb-1">
                        Propietario / Conductor asignado
                      </label>
                      <input
                        type="text"
                        value={propietario}
                        onChange={(e) => setPropietario(e.target.value)}
                        placeholder="Propio / arrendado / Nombre conductor"
                        className="w-full h-8 px-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Selector de Contrato */}
          <div className="pt-2">
            <label className="block text-[0.7rem] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Asignar a contrato
            </label>
            <select
              value={contratoId}
              onChange={(e) => setContratoId(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">Sin contrato por ahora (queda en el listado de la empresa)</option>
              {contratos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} · {c.faena?.nombre || "Faena"}
                </option>
              ))}
            </select>
            <div className="text-[0.65rem] text-slate-500 mt-1">
              Si lo asignas a un contrato, ACREDITTIA le crea de inmediato los requisitos de acreditación de esa faena.
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCerrar}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGuardarForm}
              disabled={guardando}
              className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {guardando ? "Guardando..." : `Agregar ${esPersonal ? "trabajador" : "equipo"}`}
            </button>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CARGAR EXCEL O PANTALLAZO (CHAT IA) */}
      {modo === "chat" && (
        <div className="space-y-4">
          {/* Contenedor del Chat */}
          <div
            ref={chatScrollRef}
            className="max-h-[260px] overflow-y-auto space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl"
          >
            {mensajes.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.remitente === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                    m.remitente === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-xs"
                  }`}
                >
                  {m.archivo && (
                    <div className="flex items-center gap-1.5 font-bold mb-1 opacity-90">
                      <span>{m.esImagen ? "🖼️" : "📊"}</span>
                      <span>{m.archivo}</span>
                    </div>
                  )}
                  {m.texto && (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: m.texto.replace(/\n/g, "<br/>"),
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-600 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs shadow-sm flex items-center gap-2">
                  <Spinner />
                  <span>Leyendo archivo y extrayendo registros...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input para adjuntar o pegar texto */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.csv,image/*,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar Excel o pantallazo"
              className="h-9 px-3 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center text-sm"
            >
              📎
            </button>
            <input
              type="text"
              value={textoChat}
              onChange={(e) => setTextoChat(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEnviarTexto();
                }
              }}
              placeholder={
                esPersonal
                  ? "Pega aquí: Nombre, RUT, Cargo, Teléfono, Correo (uno por línea)"
                  : "Pega aquí: Patente, Tipo, Marca, Modelo, Año (uno por línea)"
              }
              className="flex-1 h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={handleEnviarTexto}
              disabled={busy || !textoChat.trim()}
              className="h-9 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              ➤
            </button>
          </div>

          {/* TABLA PREVIA EDITABLE .ad-tbl */}
          {esPersonal && rowsPersonal.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>Registros detectados ({rowsPersonal.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    const allChecked = rowsPersonal.every((r) => r.on);
                    setRowsPersonal((prev) => prev.map((r) => ({ ...r, on: !allChecked })));
                  }}
                  className="text-blue-600 hover:underline"
                >
                  {rowsPersonal.every((r) => r.on) ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>

              <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 w-8 text-center"></th>
                      <th className="p-2">Nombre</th>
                      <th className="p-2">RUT</th>
                      <th className="p-2">Cargo</th>
                      <th className="p-2">Teléfono</th>
                      <th className="p-2">Correo</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rowsPersonal.map((row, idx) => (
                      <tr key={idx} className={row.on ? "bg-white" : "bg-slate-50 opacity-60"}>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.on}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRowsPersonal((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, on: checked } : r))
                              );
                            }}
                            className="rounded accent-blue-600"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.nombre}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsPersonal((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, nombre: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.rut}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsPersonal((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, rut: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.cargo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsPersonal((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, cargo: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.telefono}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsPersonal((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, telefono: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.email}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsPersonal((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, email: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setRowsPersonal((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-slate-400 hover:text-red-500 text-xs px-1"
                            title="Eliminar fila"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TABLA PREVIA EQUIPOS */}
          {!esPersonal && rowsEquipos.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>Vehículos y equipos detectados ({rowsEquipos.length})</span>
                <button
                  type="button"
                  onClick={() => {
                    const allChecked = rowsEquipos.every((r) => r.on);
                    setRowsEquipos((prev) => prev.map((r) => ({ ...r, on: !allChecked })));
                  }}
                  className="text-blue-600 hover:underline"
                >
                  {rowsEquipos.every((r) => r.on) ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>

              <div className="max-h-[220px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="p-2 w-8 text-center"></th>
                      <th className="p-2">Patente *</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Marca</th>
                      <th className="p-2">Modelo</th>
                      <th className="p-2 w-16">Año</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rowsEquipos.map((row, idx) => (
                      <tr key={idx} className={row.on ? "bg-white" : "bg-slate-50 opacity-60"}>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.on}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setRowsEquipos((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, on: checked } : r))
                              );
                            }}
                            className="rounded accent-blue-600"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.patente}
                            onChange={(e) => {
                              const val = e.target.value.toUpperCase();
                              setRowsEquipos((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, patente: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs uppercase font-semibold"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.tipo_equipo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsEquipos((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, tipo_equipo: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.marca}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsEquipos((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, marca: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            value={row.modelo}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsEquipos((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, modelo: val } : r))
                              );
                            }}
                            className="w-full h-7 px-1.5 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            value={row.anio}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRowsEquipos((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, anio: val } : r))
                              );
                            }}
                            className="w-16 h-7 px-1 border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-xs"
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setRowsEquipos((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="text-slate-400 hover:text-red-500 text-xs px-1"
                            title="Eliminar fila"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Opciones de contrato y botón guardar bulk */}
          {(rowsPersonal.length > 0 || rowsEquipos.length > 0) && (
            <div className="flex flex-col md:flex-row items-center gap-3 pt-3 border-t border-slate-200">
              <select
                value={contratoId}
                onChange={(e) => setContratoId(e.target.value)}
                className="flex-1 w-full h-9 px-3 border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Sin contrato por ahora (queda en el listado de la empresa)</option>
                {contratos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {c.faena?.nombre || "Faena"}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleGuardarBulk}
                disabled={guardando || totalSeleccionados === 0}
                className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                {guardando
                  ? "Guardando..."
                  : totalSeleccionados > 0
                  ? `✓ Guardar ${totalSeleccionados} ${
                      esPersonal
                        ? totalSeleccionados === 1
                          ? "trabajador"
                          : "trabajadores"
                        : totalSeleccionados === 1
                        ? "equipo"
                        : "equipos"
                    }`
                  : "Selecciona filas"}
              </button>
            </div>
          )}

          {/* Botón cerrar */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

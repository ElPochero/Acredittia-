"""Motor común de validación documental por IA (v2) — Niveles 1, 2 y 3.

Centraliza:
1. Catálogos Nivel 1 (familias) y Nivel 2 (pautas maestras por tipo de documento)
   con controles transversales ejecutados siempre antes de las reglas propias.
2. Resolución Nivel 3 (overrides por faena/contrato, umbrales y equivalencias).
3. Evaluación determinista y normalización al contrato JSON único:
   {documentData, rules, summary, status, motivo}
4. Validación cruzada por titular (cédula/padrón aprobados como fuente de verdad).
5. Correcciones de los hallazgos H1–H8 y sanitización de privacidad médica por rol.
"""

from __future__ import annotations

import copy
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

# ============================================================================
# Constantes del Contrato Estándar y Privacidad
# ============================================================================
ESTADOS_REGLA = ("OK", "OBS", "RECH", "N/A", "REV")
ESTADOS_GLOBALES = ("APROBADO", "RECHAZADO", "REQUIERE_REVISION")

FAMILIAS_VALIDACION = (
    "TRABAJADORES_DOCUMENTOS",
    "TRABAJADORES_EXAMENES",
    "TRABAJADORES_CURSOS",
    "EQUIPOS_DOCUMENTOS",
    "EQUIPOS_CERTIFICADOS",
    "EMPRESA",
)

# Solo roles autorizados de empresa/RRHH/admin pueden ver detalle clínico (H8).
ROLES_SALUD_AUTORIZADOS = frozenset({"admin", "company", "rrhh"})

CAMPOS_MEDICOS_SENSIBLES = (
    "GlosaConclusion",
    "glosa_conclusion",
    "Conclusion",
    "conclusion",
    "resultado_examen",
    "diagnostico",
    "observaciones",
    "Restricciones",
    "restricciones",
    "ObservacionesMedicas",
    "observaciones_medicas",
    "SustanciasAnalizadas",
    "sustancias_analizadas",
    "ResultadoSustancias",
    "resultado_sustancias",
    "PanelDrogas",
    "panel_drogas",
    "DetalleClinico",
    "detalle_clinico",
    "Positivo",
    "positivo",
    "diagnostico_cie10",
    "parametros_clinicos",
    "presion_arterial",
    "examen_drogas",
    "observacion_medica",
)
_CAMPOS_MEDICOS_LOWER = frozenset(c.lower() for c in CAMPOS_MEDICOS_SENSIBLES)

# Lista blanca estricta (allowlist H8): fuera de roles clínicos autorizados solo
# se exponen identificación del titular, emisor/folio, vigencia y aptitud.
_ALLOWLIST_DOC_MEDICO_LOWER = frozenset(
    {
        "rutpaciente",
        "rut",
        "run",
        "nombrepaciente",
        "nombre_completo",
        "nombre",
        "nombres",
        "apellidos",
        "cargo",
        "nombreemisor",
        "mutualidad",
        "emisor",
        "centroevaluador",
        "folio",
        "folioinforme",
        "codigoverificacion",
        "fechaatencion",
        "fechaemisioninforme",
        "fechavigenciainforme",
        "fecha_emision",
        "fecha_vencimiento",
        "fechavencimiento",
        "fechaemision",
        "contrato_id",
        "_tipo_documento_ia",
        "_accion_aplicada",
        "_fuente_verdad_aplicada",
    }
)
_REGLAS_NO_CLINICAS = frozenset(
    {
        "TIPO01",
        "DOC01",
        "DOC02",
        "DOC03",
        "DOC04",
        "ID01",
        "ID02",
        "VIG01",
        "AUT01",
        "FIRM01",
        "EXA01",
        "EXA02",
        "EXA03",
        "EXA04",
        "EXA08",
        "EXA09",
        "EXA11",
    }
)

EMISORES_EXAMEN_AUTORIZADOS = (
    "achs",
    "asociacion chilena de seguridad",
    "ist",
    "instituto de seguridad del trabajo",
    "mutual de seguridad",
    "isl",
    "instituto de seguridad laboral",
    "hospital del trabajador",
    "mutual",
)

# ============================================================================
# Nivel 1 y Nivel 2: Controles Transversales y Pautas Maestras
# ============================================================================
@dataclass(frozen=True)
class ReglaDefinicion:
    codigo: str
    campo: str
    bloqueante: bool
    descripcion: str


CONTROLES_TRANSVERSALES: tuple[ReglaDefinicion, ...] = (
    ReglaDefinicion("TIPO01", "Tipo de documento", True, "Archivo corresponde al documento solicitado"),
    ReglaDefinicion("DOC01", "Legibilidad", True, "Texto y datos clave legibles"),
    ReglaDefinicion("DOC02", "Integridad", True, "Todas las páginas presentes; documento completo"),
    ReglaDefinicion("DOC03", "Alteraciones", True, "Sin indicios de edición, superposición o adulteración"),
    ReglaDefinicion("DOC04", "Formato", True, "Formato y emisor esperados para el documento"),
    ReglaDefinicion("ID01", "Titular correcto", True, "RUT o patente coincide con el sujeto registrado"),
    ReglaDefinicion("ID02", "Nombre correcto", True, "Nombre coincide con el registrado y cédula aprobada"),
    ReglaDefinicion("VIG01", "Vigencia", True, "Fecha de vencimiento vigente"),
    ReglaDefinicion("AUT01", "Autenticidad", True, "Verificación contra fuente oficial (MRZ/QR/Portal/Folio)"),
    ReglaDefinicion("FIRM01", "Firmas y timbres", True, "Firmas y timbres obligatorios presentes"),
    ReglaDefinicion("FAE01", "Requisitos de faena", True, "Exigencias adicionales del mandante (Nivel 3)"),
)

_CONTRATO_TRANSVERSAL_OVERRIDES = {
    "VIG01": "Fecha de inicio",
    "FIRM01": "Firma trabajador",
}

PAUTAS_MAESTRAS: dict[str, tuple[ReglaDefinicion, ...]] = {
    "cedula": (
        ReglaDefinicion("CED01", "Tipo y caras de cédula", True, "Tipo nueva/antigua y ambas caras cargadas"),
        ReglaDefinicion("CED02", "RUN coincide con trabajador", True, "RUN del documento = RUT del trabajador"),
        ReglaDefinicion("CED03", "Cruce de datos MRZ", True, "Número, nacimiento, vencimiento, apellidos y sexo vs MRZ"),
        ReglaDefinicion("CED04", "Vigencia de cédula", True, "Fecha de vencimiento vigente"),
        ReglaDefinicion("CED05", "Foto, firma y huella", False, "Presencia de fotografía, firma y huella"),
        ReglaDefinicion("CED06", "Nombres y apellidos vs ficha", True, "Nombres y apellidos coinciden con ficha"),
    ),
    "licencia": (
        ReglaDefinicion("LIC01", "RUN coincide con trabajador", True, "RUN del titular = RUT del trabajador"),
        ReglaDefinicion("LIC02", "Clase de licencia", True, "Clase(s) de licencia A1–A5, B, C, D, E, F"),
        ReglaDefinicion("LIC03", "Clase compatible con cargo/faena", True, "Clase compatible con cargo y faena"),
        ReglaDefinicion("LIC04", "Control / vencimiento vigente", True, "Fecha de control vigente"),
        ReglaDefinicion("LIC05", "Municipalidad y restricciones", False, "Municipalidad emisora y restricciones"),
        ReglaDefinicion("LIC06", "Ambas caras cargadas", True, "Anverso y reverso presentes"),
    ),
    "hvc": (
        ReglaDefinicion("HVC01", "RUN y emisor Registro Civil", True, "RUN = RUT del trabajador; emitido por Registro Civil"),
        ReglaDefinicion("HVC02", "Antigüedad máxima emisión", True, "Fecha de emisión dentro de antigüedad exigida"),
        ReglaDefinicion("HVC03", "Folio / código verificación", True, "Verificación por folio o código"),
        ReglaDefinicion("HVC04", "Licencias coinciden con licencia", True, "Licencias registradas coinciden con licencia"),
        ReglaDefinicion("HVC05", "Anotaciones e infracciones", False, "Infracciones graves/gravísimas, suspensiones"),
    ),
    "antecedentes": (
        ReglaDefinicion("ANT01", "RUN y emisor Registro Civil", True, "RUN = RUT trabajador; emitido por Registro Civil"),
        ReglaDefinicion("ANT02", "Finalidad del certificado", True, "Fines especiales / particulares según exigencia"),
        ReglaDefinicion("ANT03", "Antigüedad máxima emisión", True, "Fecha de emisión dentro de antigüedad máxima"),
        ReglaDefinicion("ANT04", "Folio y código verificación", True, "Verificación por folio y código"),
        ReglaDefinicion("ANT05", "Registro de anotaciones", False, "Indica si registra o no anotaciones"),
    ),
    "pasaporte": (
        ReglaDefinicion("PAS01", "Número y nacionalidad", True, "Número de documento y nacionalidad vs ficha"),
        ReglaDefinicion("PAS02", "Cruce de datos MRZ", True, "Cruce de datos contra MRZ"),
        ReglaDefinicion("PAS03", "Vigencia de pasaporte", True, "Fecha de vencimiento vigente"),
    ),
    "contrato": (
        ReglaDefinicion("EMP01", "Razón social", True, "Razón social del empleador"),
        ReglaDefinicion("EMP02", "RUT empresa", True, "RUT del contratista acreditado"),
        ReglaDefinicion("EMP03", "Representante legal", True, "Representante legal identificado"),
        ReglaDefinicion("EMP04", "Domicilio empresa", True, "Domicilio del empleador"),
        ReglaDefinicion("REM01", "Monto remuneración", True, "Monto de remuneración estipulado"),
        ReglaDefinicion("REM02", "Forma de pago", True, "Forma de pago estipulada"),
        ReglaDefinicion("REM03", "Período de pago", True, "Período de pago estipulado"),
        ReglaDefinicion("REM04", "Ingreso mínimo", True, "Remuneración >= ingreso mínimo vigente"),
        ReglaDefinicion("VIG02", "Tipo de contrato", True, "Indefinido, plazo fijo o por obra/faena"),
        ReglaDefinicion("VIG03", "Plazo fijo", True, "Plazo fijo dentro de límite legal y vigente"),
        ReglaDefinicion("VIG04", "Fecha del contrato", True, "Fecha de suscripción y vigencia"),
        ReglaDefinicion("COMP01", "Cláusula de confidencialidad", False, "Cláusula de confidencialidad"),
        ReglaDefinicion("COMP02", "Cláusula de no competencia", False, "Cláusula de no competencia"),
        ReglaDefinicion("COMP03", "Beneficios adicionales", False, "Beneficios adicionales"),
        ReglaDefinicion("COMP04", "Horas extraordinarias", False, "Pacto de horas extraordinarias"),
        ReglaDefinicion("COMP05", "Datos de contacto", False, "Datos de contacto del trabajador"),
        ReglaDefinicion("FIRM02", "Firma empleador", True, "Firma del empleador presente"),
        ReglaDefinicion("FIRM03", "Consistencia firmas", True, "Consistencia entre firmas y partes"),
        ReglaDefinicion("JORN01", "Duración jornada", True, "Duración de jornada declarada"),
        ReglaDefinicion("JORN02", "Distribución jornada", True, "Distribución semanal de jornada"),
        ReglaDefinicion("JORN03", "Límite legal jornada", True, "Límite legal semanal según Ley 40 Horas"),
        ReglaDefinicion("JORN04", "Art. 22 inc. 2°", False, "Exclusión de limitación de jornada"),
        ReglaDefinicion("SERV01", "Cargo/Función", True, "Cargo compatible con el declarado en plataforma"),
        ReglaDefinicion("SERV02", "Lugar de trabajo", True, "Lugar de trabajo / faena estipulado"),
        ReglaDefinicion("TRAB01", "Nombre completo trabajador", True, "Nombre coincide con sujeto esperado"),
        ReglaDefinicion("TRAB02", "RUT trabajador", True, "RUT coincide con sujeto esperado"),
        ReglaDefinicion("TRAB03", "Fecha de nacimiento", False, "Fecha de nacimiento del trabajador"),
        ReglaDefinicion("TRAB04", "Nacionalidad", False, "Nacionalidad del trabajador"),
        ReglaDefinicion("TRAB05", "Estado civil", False, "Estado civil del trabajador"),
        ReglaDefinicion("TRAB06", "Domicilio trabajador", False, "Domicilio del trabajador"),
        ReglaDefinicion("EXCL01", "Presencia anexo exclusividad", False, "Anexo de exclusividad según mandante"),
        ReglaDefinicion("EXCL02", "Individualización anexo", False, "Individualización del anexo"),
        ReglaDefinicion("EXCL03", "Declaración de exclusividad", False, "Declaración de exclusividad"),
        ReglaDefinicion("EXCL04", "Vigencia del anexo", False, "Vigencia del anexo"),
        ReglaDefinicion("EXCL05", "Firmas del anexo", False, "Firmas del anexo"),
        ReglaDefinicion("EXCL06", "Contrato comercial", False, "Referencia a contrato comercial"),
    ),
    "anexo": (
        ReglaDefinicion("ANX01", "Identifica contrato base", True, "Identifica el contrato que modifica"),
        ReglaDefinicion("ANX02", "Mismo trabajador y empleador", True, "Mismas partes del contrato"),
        ReglaDefinicion("ANX03", "Materia del anexo", True, "Prórroga, indefinido, remuneración, jornada, cargo o faena"),
        ReglaDefinicion("ANX04", "Vigencia de prórroga", True, "Si es prórroga, nueva fecha vigente"),
        ReglaDefinicion("ANX05", "Firmas de ambas partes", True, "Firmas de trabajador y empleador"),
    ),
    "finiquito": (
        ReglaDefinicion("FIN01", "Trabajador y empleador", True, "Trabajador y empleador correctos"),
        ReglaDefinicion("FIN02", "Fecha de término y causal", True, "Fecha de término y causal legal"),
        ReglaDefinicion("FIN03", "Ratificación / ministro de fe", True, "Ministro de fe o firma electrónica DT"),
    ),
    "odi": (
        ReglaDefinicion("ODI01", "Trabajador y cargo", True, "Trabajador y cargo identificados"),
        ReglaDefinicion("ODI02", "Riesgos informados faena", True, "Riesgos informados para la faena"),
        ReglaDefinicion("ODI03", "Fecha y firmas", True, "Fecha, firma del trabajador y de quien informa"),
    ),
    "epp": (
        ReglaDefinicion("EPP01", "Trabajador e ítems", True, "Trabajador y elementos entregados"),
        ReglaDefinicion("EPP02", "Fecha y firma recepción", True, "Fecha y firma de recepción"),
    ),
    "rioshs": (
        ReglaDefinicion("RIO01", "Trabajador y empresa", True, "Trabajador y empresa identificados"),
        ReglaDefinicion("RIO02", "Fecha y firma recepción", True, "Fecha y firma de recepción"),
    ),
    "carta_designacion": (
        ReglaDefinicion("CAR01", "Persona designada y función", True, "Persona y función declaradas"),
        ReglaDefinicion("CAR02", "Fecha, firmas y notaría", True, "Fecha, firmas y notaría si aplica"),
    ),
    "examen": (
        ReglaDefinicion("EXA01", "Emisor autorizado", True, "ACHS, IST, Mutual, ISL o centro autorizado"),
        ReglaDefinicion("EXA02", "RUT paciente = trabajador", True, "RUT del paciente coincide con trabajador"),
        ReglaDefinicion("EXA03", "Nombre paciente = trabajador/cédula", True, "Nombre coherente con ficha y cédula aprobada"),
        ReglaDefinicion("EXA04", "RUT empresa = contratista", True, "RUT de la empresa coincide con contratista"),
        ReglaDefinicion("EXA05", "Tipo de examen y riesgo evaluado", True, "Riesgo evaluado corresponde al exigido"),
        ReglaDefinicion("EXA06", "Conclusión de aptitud", True, "APTO / APTO CON RESTRICCIONES / NO APTO / PENDIENTE"),
        ReglaDefinicion("EXA07", "Restricciones u observaciones médicas", False, "Restricciones médicas informadas"),
        ReglaDefinicion("EXA08", "Fechas y vigencia del examen", True, "Fecha atención, emisión y vigencia"),
        ReglaDefinicion("EXA09", "Verificación en portal oficial", True, "Comparación campo a campo por folio"),
        ReglaDefinicion("EXA10", "Cargo del paciente compatible", False, "Cargo compatible con plataforma"),
        ReglaDefinicion("EXA11", "Firma y timbre médico", True, "Firma y timbre o firma electrónica"),
    ),
    "curso": (
        ReglaDefinicion("CUR01", "Nombre y catálogo maestro", True, "Clasificación contra catálogo maestro/equivalencias"),
        ReglaDefinicion("CUR02", "RUT y nombre participante", True, "Participante coincide con trabajador"),
        ReglaDefinicion("CUR03", "Organismo capacitador", True, "OTEC SENCE, mutualidad, mandante o relator"),
        ReglaDefinicion("CUR04", "Horas de duración mínimas", False, "Horas >= mínimo exigido por la faena"),
        ReglaDefinicion("CUR05", "Aprobación / nota / asistencia", True, "Resultado aprobado y nota/asistencia >= mínimo"),
        ReglaDefinicion("CUR06", "Modalidad teórico-práctica", False, "Modalidad exigida por el mandante"),
        ReglaDefinicion("CUR07", "Fecha realización y vigencia", True, "Fecha y vigencia vigente"),
        ReglaDefinicion("CUR08", "Código verificación / QR / folio", False, "Verificación en línea cuando exista portal"),
        ReglaDefinicion("CUR09", "Firma relator y timbre", True, "Firma del relator/organismo y timbre"),
    ),
    "equipo_doc": (
        ReglaDefinicion("EQD01", "Patente = ficha equipo", True, "Patente del documento coincide con equipo"),
        ReglaDefinicion("EQD02", "VIN / chasis y motor", True, "VIN/chasis y motor coinciden con ficha"),
        ReglaDefinicion("EQD03", "Marca, modelo, año y tipo", False, "Datos del vehículo coherentes con ficha"),
        ReglaDefinicion("EQD04", "Vigencia documento equipo", True, "Documento vigente"),
        ReglaDefinicion("EQD05", "Verificación folio / QR oficial", True, "Verificación oficial cuando exista fuente"),
    ),
    "equipo_cert": (
        ReglaDefinicion("EQC01", "Equipo identificado", True, "Patente/serie, marca y modelo coinciden"),
        ReglaDefinicion("EQC02", "Organismo certificador acreditado", True, "Acreditación INN, fabricante o inspector"),
        ReglaDefinicion("EQC03", "Norma o estándar aplicado", False, "NCh, ASME B30, ISO, EN según faena"),
        ReglaDefinicion("EQC04", "Parámetros técnicos extraídos", True, "Capacidad, carga máxima, alcance, presión"),
        ReglaDefinicion("EQC05", "Parámetros >= mínimos faena", False, "Cumple mínimos exigidos por faena"),
        ReglaDefinicion("EQC06", "Resultado certificación", True, "APROBADO / CON OBS / RECHAZADO y hallazgos"),
        ReglaDefinicion("EQC07", "Fecha inspección y vigencia", True, "Fecha inspección y vigencia/próxima"),
        ReglaDefinicion("EQC08", "Firma, timbre y QR/código", True, "Firma/timbre inspector y verificación"),
    ),
    "empresa": (
        ReglaDefinicion("EMPR01", "RUT empresa", True, "RUT del documento = RUT contratista"),
        ReglaDefinicion("EMPR02", "Razón social empresa", True, "Razón social coincide con empresa"),
        ReglaDefinicion("EMPR03", "Contenido específico empresa", True, "Datos obligatorios del documento de empresa"),
        ReglaDefinicion("EMPR04", "Vigencia / período certificado", True, "Emisión o período dentro de vigencia"),
    ),
}

_TIPO_A_PAUTA = {
    "cedula": "cedula",
    "licencia": "licencia",
    "hvc": "hvc",
    "antecedentes": "antecedentes",
    "pasaporte": "pasaporte",
    "contrato": "contrato",
    "anexo": "anexo",
    "finiquito": "finiquito",
    "odi": "odi",
    "epp": "epp",
    "rioshs": "rioshs",
    "carta_designacion": "carta_designacion",
    "documento_laboral": "odi",
    "examen": "examen",
    "examen_altura": "examen",
    "examen_altura_geo": "examen",
    "examen_psico": "examen",
    "examen_alcohol_drogas": "examen",
    "examen_preocupacional": "examen",
    "examen_ocupacional": "examen",
    "examen_audiometria": "examen",
    "examen_espirometria": "examen",
    "curso": "curso",
    "curso_manejo_defensivo": "curso",
    "curso_hazmat": "curso",
    "curso_trabajo_altura": "curso",
    "curso_primeros_auxilios": "curso",
    "curso_extintores": "curso",
    "curso_rigger": "curso",
    "curso_induccion": "curso",
    "equipo_doc": "equipo_doc",
    "padron": "equipo_doc",
    "cav": "equipo_doc",
    "circulacion": "equipo_doc",
    "revtec": "equipo_doc",
    "soap": "equipo_doc",
    "seguro_rc": "equipo_doc",
    "homologacion": "equipo_doc",
    "arriendo_leasing": "equipo_doc",
    "equipo_cert": "equipo_cert",
    "cert_grua": "equipo_cert",
    "izaje": "equipo_cert",
    "rampla": "equipo_cert",
    "cert_gps": "equipo_cert",
    "fabricacion": "equipo_cert",
    "checklist": "equipo_cert",
    "mantencion": "equipo_cert",
    "ficha_tecnica": "equipo_cert",
    "empresa_doc": "empresa",
    "empresa": "empresa",
    "erut": "empresa",
    "vigencia_sociedad": "empresa",
    "f30": "empresa",
    "f30_1": "empresa",
    "mutual": "empresa",
    "escritura": "empresa",
    "iso": "empresa",
}

_TIPO_A_FAMILIA = {
    "cedula": "TRABAJADORES_DOCUMENTOS",
    "licencia": "TRABAJADORES_DOCUMENTOS",
    "hvc": "TRABAJADORES_DOCUMENTOS",
    "antecedentes": "TRABAJADORES_DOCUMENTOS",
    "pasaporte": "TRABAJADORES_DOCUMENTOS",
    "contrato": "TRABAJADORES_DOCUMENTOS",
    "anexo": "TRABAJADORES_DOCUMENTOS",
    "finiquito": "TRABAJADORES_DOCUMENTOS",
    "odi": "TRABAJADORES_DOCUMENTOS",
    "epp": "TRABAJADORES_DOCUMENTOS",
    "rioshs": "TRABAJADORES_DOCUMENTOS",
    "carta_designacion": "TRABAJADORES_DOCUMENTOS",
    "documento_laboral": "TRABAJADORES_DOCUMENTOS",
    "examen": "TRABAJADORES_EXAMENES",
    "examen_altura": "TRABAJADORES_EXAMENES",
    "examen_altura_geo": "TRABAJADORES_EXAMENES",
    "examen_psico": "TRABAJADORES_EXAMENES",
    "examen_alcohol_drogas": "TRABAJADORES_EXAMENES",
    "examen_preocupacional": "TRABAJADORES_EXAMENES",
    "examen_ocupacional": "TRABAJADORES_EXAMENES",
    "examen_audiometria": "TRABAJADORES_EXAMENES",
    "examen_espirometria": "TRABAJADORES_EXAMENES",
    "curso": "TRABAJADORES_CURSOS",
    "curso_manejo_defensivo": "TRABAJADORES_CURSOS",
    "curso_hazmat": "TRABAJADORES_CURSOS",
    "curso_trabajo_altura": "TRABAJADORES_CURSOS",
    "curso_primeros_auxilios": "TRABAJADORES_CURSOS",
    "curso_extintores": "TRABAJADORES_CURSOS",
    "curso_rigger": "TRABAJADORES_CURSOS",
    "curso_induccion": "TRABAJADORES_CURSOS",
    "equipo_doc": "EQUIPOS_DOCUMENTOS",
    "padron": "EQUIPOS_DOCUMENTOS",
    "cav": "EQUIPOS_DOCUMENTOS",
    "circulacion": "EQUIPOS_DOCUMENTOS",
    "revtec": "EQUIPOS_DOCUMENTOS",
    "soap": "EQUIPOS_DOCUMENTOS",
    "seguro_rc": "EQUIPOS_DOCUMENTOS",
    "homologacion": "EQUIPOS_DOCUMENTOS",
    "arriendo_leasing": "EQUIPOS_DOCUMENTOS",
    "equipo_cert": "EQUIPOS_CERTIFICADOS",
    "cert_grua": "EQUIPOS_CERTIFICADOS",
    "izaje": "EQUIPOS_CERTIFICADOS",
    "rampla": "EQUIPOS_CERTIFICADOS",
    "cert_gps": "EQUIPOS_CERTIFICADOS",
    "fabricacion": "EQUIPOS_CERTIFICADOS",
    "checklist": "EQUIPOS_CERTIFICADOS",
    "mantencion": "EQUIPOS_CERTIFICADOS",
    "ficha_tecnica": "EQUIPOS_CERTIFICADOS",
    "empresa_doc": "EMPRESA",
    "empresa": "EMPRESA",
    "erut": "EMPRESA",
    "vigencia_sociedad": "EMPRESA",
    "f30": "EMPRESA",
    "f30_1": "EMPRESA",
    "mutual": "EMPRESA",
    "escritura": "EMPRESA",
    "iso": "EMPRESA",
}

TIPOS_DOCUMENTO_VALIDOS = frozenset(_TIPO_A_PAUTA.keys()) | frozenset(PAUTAS_MAESTRAS.keys()) | {"documento_laboral"}


# ============================================================================
# Utilidades de normalización y clasificación
# ============================================================================
def normalizar_texto(val: str | None) -> str:
    if not val:
        return ""
    s = unicodedata.normalize("NFD", str(val).strip().upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9\s]", " ", s).strip()


def normalizar_tokens_nombre(nombre: str | None) -> list[str]:
    norm = normalizar_texto(nombre)
    return [t for t in norm.split() if len(t) > 1]


def normalizar_rut_compacto(rut: str | None) -> str:
    if not rut:
        return ""
    return re.sub(r"[^0-9K]", "", str(rut).upper())


def normalizar_patente(pat: str | None) -> str:
    if not pat:
        return ""
    return re.sub(r"[^A-Z0-9]", "", str(pat).upper())


def nombres_coinciden(a: str | None, b: str | None) -> tuple[bool, str]:
    """Compara dos nombres normalizados.

    - Si todos los tokens del nombre más corto están en el otro (ej. "Alfredo Roco"
      vs "Alfredo Francisco Roco Carvajal") pero los nombres de pila disponibles
      difieren (ej. "ALFONSO FRANCISCO ROCO CARVAJAL" vs "ALFREDO FRANCISCO ROCO
      CARVAJAL"), devuelve False con el motivo de discrepancia.
    """
    ta = normalizar_tokens_nombre(a)
    tb = normalizar_tokens_nombre(b)
    if not ta or not tb:
        return False, "nombre faltante"
    sa, sb = set(ta), set(tb)
    if sa == sb:
        return True, "exacto"
    # Subconjunto estricto (p.ej. ficha sin segundo nombre/apellido)
    if sa.issubset(sb) or sb.issubset(sa):
        return True, "parcial_compatible"
    return False, f"tokens distintos ({' '.join(ta)} vs {' '.join(tb)})"


def inferir_clasificacion_documento(
    titulo: str,
    contexto: str = "personal",
    ejemplo_clave: str | None = None,
    familia_override: str | None = None,
    tipo_override: str | None = None,
) -> tuple[str, str]:
    """Determina (familia_validacion, tipo_documento_ia) desde plantilla o título."""
    if tipo_override:
        fam = familia_override or _TIPO_A_FAMILIA.get(tipo_override, "TRABAJADORES_DOCUMENTOS")
        return fam, tipo_override

    t = normalizar_texto(titulo)
    ej = normalizar_texto(ejemplo_clave)
    ctx = (contexto or "").strip().lower()

    if "LICENCIA" in t or "CONDUCIR" in t or ej == "LICENCIA":
        return "TRABAJADORES_DOCUMENTOS", "licencia"
    if any(k in t for k in ("CEDULA", "IDENTIDAD", "CARNET")) or ej == "CEDULA":
        return "TRABAJADORES_DOCUMENTOS", "cedula"
    if "HOJA DE VIDA" in t or "HVC" in t:
        return "TRABAJADORES_DOCUMENTOS", "hvc"
    if "ANTECEDENTE" in t:
        return "TRABAJADORES_DOCUMENTOS", "antecedentes"
    if "PASAPORTE" in t:
        return "TRABAJADORES_DOCUMENTOS", "pasaporte"
    if "ANEXO" in t:
        return "TRABAJADORES_DOCUMENTOS", "anexo"
    if "CONTRATO" in t and ctx != "empresa" and "SERVICIO" not in t:
        return "TRABAJADORES_DOCUMENTOS", "contrato"
    if "FINIQUITO" in t or ej == "FINIQUITO":
        return "TRABAJADORES_DOCUMENTOS", "finiquito"
    if "ODI" in t or "IRL" in t or "OBLIGACION DE INFORMAR" in t or ej in ("ODI", "IRLMINA"):
        return "TRABAJADORES_DOCUMENTOS", "odi"
    if "EPP" in t:
        return "TRABAJADORES_DOCUMENTOS", "epp"
    if "REGLAMENTO INTERNO" in t or "RIOSHS" in t or ej == "RIOSHS":
        return "TRABAJADORES_DOCUMENTOS", "rioshs"

    # Cursos y capacitaciones (antes de exámenes para evitar colisiones como "Curso Trabajo en Altura")
    if ctx not in ("equipo", "empresa"):
        if any(k in t for k in ("MANEJO DEFENSIVO", "CONDUCCION DEFENSIVA")):
            return "TRABAJADORES_CURSOS", "curso_manejo_defensivo"
        if "HAZMAT" in t or "SUSTANCIAS PELIGROSAS" in t:
            return "TRABAJADORES_CURSOS", "curso_hazmat"
        if "INDUCCION" in t or "HOMBRE NUEVO" in t or ej == "INDUCCION":
            return "TRABAJADORES_CURSOS", "curso_induccion"
        if "EXTINTOR" in t:
            return "TRABAJADORES_CURSOS", "curso_extintores"
        if "PRIMEROS AUXILIOS" in t:
            return "TRABAJADORES_CURSOS", "curso_primeros_auxilios"
        if "RIGGER" in t or "GRUA" in t:
            return "TRABAJADORES_CURSOS", "curso_rigger"
        if ("CURSO" in t or "CAPACITACION" in t) and "ALTURA" in t:
            return "TRABAJADORES_CURSOS", "curso_trabajo_altura"
        if any(k in t for k in ("CURSO", "CAPACITACION")) or ej == "CURSO":
            return "TRABAJADORES_CURSOS", "curso"

    # Exámenes médicos (solo en contexto de personal o genérico sin contexto equipo/empresa)
    if ctx not in ("equipo", "empresa"):
        if "ALTURA GEOGRAFICA" in t:
            return "TRABAJADORES_EXAMENES", "examen_altura_geo"
        if "PSICOSENS" in t or ej == "PSICO":
            return "TRABAJADORES_EXAMENES", "examen_psico"
        if "ALCOHOL" in t or "DROGA" in t or ej == "CONSENTIMIENTO":
            return "TRABAJADORES_EXAMENES", "examen_alcohol_drogas"
        if "PREOCUPACIONAL" in t:
            return "TRABAJADORES_EXAMENES", "examen_preocupacional"
        if "AUDIOMETR" in t:
            return "TRABAJADORES_EXAMENES", "examen_audiometria"
        if "ESPIROMETR" in t or "RADIOGRAF" in t:
            return "TRABAJADORES_EXAMENES", "examen_espirometria"
        if any(k in t for k in ("EXAMEN", "SALUD", "ALTURA", "OCUPACIONAL")) or ej == "ALTURA":
            return "TRABAJADORES_EXAMENES", "examen_altura"

    # Equipos
    if "PADRON" in t or "INSCRIPCION" in t:
        return "EQUIPOS_DOCUMENTOS", "padron"
    if "ANOTACIONES VIGENTES" in t or "CAV" in t:
        return "EQUIPOS_DOCUMENTOS", "cav"
    if "CIRCULACION" in t or ej == "CIRCULACION":
        return "EQUIPOS_DOCUMENTOS", "circulacion"
    if "REVISION TECNICA" in t or ej == "REVTEC":
        return "EQUIPOS_DOCUMENTOS", "revtec"
    if "SOAP" in t or ej == "SOAP":
        return "EQUIPOS_DOCUMENTOS", "soap"
    if "RESPONSABILIDAD CIVIL" in t or "SEGURO" in t:
        return "EQUIPOS_DOCUMENTOS", "seguro_rc"
    if "HOMOLOGACION" in t:
        return "EQUIPOS_DOCUMENTOS", "homologacion"
    if "ARRIENDO" in t or "LEASING" in t:
        return "EQUIPOS_DOCUMENTOS", "arriendo_leasing"
    if "GRUA" in t or "PLUMA" in t:
        return "EQUIPOS_CERTIFICADOS", "cert_grua"
    if "IZAJE" in t:
        return "EQUIPOS_CERTIFICADOS", "izaje"
    if "RAMPLA" in t or "SEMIRREMOLQUE" in t:
        return "EQUIPOS_CERTIFICADOS", "rampla"
    if "GPS" in t or "BARRA" in t or ej in ("GPS", "BARRA"):
        return "EQUIPOS_CERTIFICADOS", "cert_gps"
    if "CHECKLIST" in t or "INSPECCION" in t or ej == "CHECKLIST":
        return "EQUIPOS_CERTIFICADOS", "checklist"
    if "MANTENCION" in t or "OPERATIVIDAD" in t or ej == "MANTENCION":
        return "EQUIPOS_CERTIFICADOS", "mantencion"
    if "FICHA TECNICA" in t:
        return "EQUIPOS_CERTIFICADOS", "ficha_tecnica"
    if ctx == "equipo" and ("CERTIFICAD" in t or "ALTURA" in t):
        return "EQUIPOS_CERTIFICADOS", "equipo_cert"

    # Empresa
    if "E RUT" in t or "ERUT" in t:
        return "EMPRESA", "erut"
    if "F30" in t:
        return "EMPRESA", "f30_1"
    if "MUTUAL" in t or "16 744" in t or ej == "MUTUAL":
        return "EMPRESA", "mutual"
    if ctx == "empresa":
        return "EMPRESA", "empresa_doc"
    if ctx == "equipo":
        return "EQUIPOS_DOCUMENTOS", "equipo_doc"
    return "TRABAJADORES_DOCUMENTOS", "documento_laboral"


# ============================================================================
# Hallazgo 3 y Hallazgo 4: Normalización de jornada + Ley 40 Horas
# ============================================================================
def limite_jornada_legal_semanal(fecha_referencia: date | None = None) -> int:
    """Ley 21.561 (Ley 40 Horas) parametrizada por fecha:
    - Desde 2028-04-26: 40 h/semana
    - Desde 2026-04-26: 42 h/semana
    - Desde 2024-04-26: 44 h/semana
    - Anterior a 2024-04-26: 45 h/semana
    """
    ref = fecha_referencia or date.today()
    if ref >= date(2028, 4, 26):
        return 40
    if ref >= date(2026, 4, 26):
        return 42
    if ref >= date(2024, 4, 26):
        return 44
    return 45


def normalizar_jornada_a_semanal(
    valor: Any, distribucion_dias: str | None = None
) -> tuple[float | None, str]:
    """Convierte duraciones mensuales/diarias/semanales a horas semanales (H3)."""
    if valor is None:
        return None, "sin dato"
    if isinstance(valor, (int, float)):
        return float(valor), "semanal"
    texto = str(valor).strip()
    m = re.search(r"(\d+(?:[.,]\d+)?)", texto)
    if not m:
        return None, "no interpretable"
    numero = float(m.group(1).replace(",", "."))
    tl = texto.lower()
    if any(k in tl for k in ("mensual", "mes", "/mes")):
        # 180 horas mensuales ≈ 42 horas semanales (180 * 7 / 30 = 42.0)
        semanal = round(numero * 7.0 / 30.0, 1)
        return semanal, f"mensual ({numero:g} h/mes -> {semanal:g} h/semana)"
    if any(k in tl for k in ("diaria", "diario", "dia", "día")):
        dias = 5.0
        if distribucion_dias:
            md = re.search(r"(\d+)\s*d[ií]a", str(distribucion_dias).lower())
            if md and 1 <= int(md.group(1)) <= 7:
                dias = float(md.group(1))
        semanal = round(numero * dias, 1)
        return semanal, f"diaria ({numero:g} h/día x {dias:g}d -> {semanal:g} h/semana)"
    return numero, f"semanal ({numero:g} h/semana)"


# ============================================================================
# Nivel 3: Resolución de pauta efectiva (maestra + overrides por faena)
# ============================================================================
def resolver_pauta_efectiva(
    tipo_documento_ia: str,
    override: dict[str, Any] | None = None,
) -> tuple[list[ReglaDefinicion], dict[str, Any], dict[str, bool]]:
    """Combina controles transversales (primero) + pauta maestra + Nivel 3.

    Devuelve: (lista ordenada de ReglaDefinicion, parametros efectivos, mapa reglas_activas)
    """
    pauta_key = _TIPO_A_PAUTA.get(tipo_documento_ia, "documento_laboral")
    especificas = PAUTAS_MAESTRAS.get(pauta_key, ())

    override = override or {}
    reglas_activas: dict[str, bool] = dict(override.get("reglas_activas") or {})
    bloqueantes_ov: dict[str, bool] = dict(override.get("bloqueantes_override") or {})
    parametros: dict[str, Any] = dict(override.get("parametros") or {})

    # Si el documento es contrato, ajustamos los títulos de VIG01/FIRM01 en la
    # cabecera transversal sin duplicar códigos.
    transversales: list[ReglaDefinicion] = []
    for r in CONTROLES_TRANSVERSALES:
        campo = _CONTRATO_TRANSVERSAL_OVERRIDES.get(r.codigo, r.campo) if pauta_key == "contrato" else r.campo
        bloq = bool(bloqueantes_ov[r.codigo]) if r.codigo in bloqueantes_ov else r.bloqueante
        transversales.append(ReglaDefinicion(r.codigo, campo, bloq, r.descripcion))

    codigos_transv = {r.codigo for r in transversales}
    propias: list[ReglaDefinicion] = []
    for r in especificas:
        if r.codigo in codigos_transv:
            continue
        bloq = bool(bloqueantes_ov[r.codigo]) if r.codigo in bloqueantes_ov else r.bloqueante
        propias.append(ReglaDefinicion(r.codigo, r.campo, bloq, r.descripcion))

    return transversales + propias, parametros, reglas_activas


# ============================================================================
# Motor Común de Evaluación Determinista (H1–H7 + Salida Estándar)
# ============================================================================
def _parse_fecha(valor: Any) -> date | None:
    if not valor:
        return None
    if isinstance(valor, date) and not isinstance(valor, datetime):
        return valor
    if isinstance(valor, datetime):
        return valor.date()
    s = str(valor).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


_RUT_TRABAJADOR_PATHS = (
    ("RUN",),
    ("RUTPaciente",),
    ("trabajador", "rut"),
    ("participante", "rut"),
    ("RUT",),
    ("rut",),
)
_RUT_EMPRESA_PATHS = (
    ("RUTEmpresa",),
    ("empleador", "rut"),
    ("empresa", "rut"),
    ("rut_empresa",),
    ("RUT",),
    ("rut",),
)
_NOMBRE_TRABAJADOR_PATHS = (
    ("NombrePaciente",),
    ("nombre_completo",),
    ("trabajador", "nombre"),
    ("participante", "nombre"),
    ("nombre",),
)
_NOMBRE_EMPRESA_PATHS = (
    ("razon_social",),
    ("empleador", "razon_social"),
    ("empresa", "razon_social"),
    ("NombreEmpresa",),
    ("nombre",),
)


def _extraer_rut_documento(
    doc_data: dict[str, Any], familia: str = "TRABAJADORES_DOCUMENTOS"
) -> str | None:
    paths = _RUT_EMPRESA_PATHS if familia == "EMPRESA" else _RUT_TRABAJADOR_PATHS
    for path in paths:
        cur: Any = doc_data
        for k in path:
            cur = cur.get(k) if isinstance(cur, dict) else None
        if cur:
            return str(cur)
    return None


def _extraer_nombre_documento(
    doc_data: dict[str, Any], familia: str = "TRABAJADORES_DOCUMENTOS"
) -> str | None:
    if familia != "EMPRESA":
        nombres = doc_data.get("Nombres")
        apellidos = doc_data.get("Apellidos")
        if nombres or apellidos:
            return f"{nombres or ''} {apellidos or ''}".strip()
        paths = _NOMBRE_TRABAJADOR_PATHS
    else:
        paths = _NOMBRE_EMPRESA_PATHS
    for path in paths:
        cur: Any = doc_data
        for k in path:
            cur = cur.get(k) if isinstance(cur, dict) else None
        if cur:
            return str(cur)
    return None


def _extraer_patente_documento(doc_data: dict[str, Any]) -> str | None:
    for k in ("Patente", "patente", "PPU", "ppu"):
        if doc_data.get(k):
            return str(doc_data[k])
    return None


def _extraer_fecha_vencimiento(doc_data: dict[str, Any]) -> date | None:
    for path in (
        ("FechaVencimiento",),
        ("fecha_vencimiento",),
        ("FechaVigenciaInforme",),
        ("vigencia", "fecha_termino"),
        ("fecha_termino",),
        ("vencimiento",),
    ):
        cur: Any = doc_data
        for k in path:
            cur = cur.get(k) if isinstance(cur, dict) else None
        f = _parse_fecha(cur)
        if f is not None:
            return f
    return None


def calcular_resumen_y_estado(rules: list[dict[str, Any]]) -> tuple[dict[str, int], str, str]:
    """Calcula summary y garantiza invariante H6 entre rules, summary, status y motivo."""
    summary = {"OK": 0, "OBS": 0, "RECH": 0, "N/A": 0, "REV": 0, "total": len(rules)}
    for r in rules:
        res = r["resultado"]
        if res in summary:
            summary[res] += 1

    rech_bloq = [r for r in rules if r["resultado"] == "RECH" and r["bloqueante"]]
    if rech_bloq:
        motivo = "; ".join(
            f"{r['codigo']} ({r['campo']}): {r['observacion'] or 'Incumplimiento bloqueante'}"
            for r in rech_bloq
        )
        return summary, "RECHAZADO", motivo

    rev_o_rech_no_bloq = [
        r for r in rules if r["resultado"] == "REV" or r["resultado"] == "RECH"
    ]
    if rev_o_rech_no_bloq:
        motivo = "; ".join(
            f"{r['codigo']} ({r['campo']}): {r['observacion'] or 'Requiere revisión manual'}"
            for r in rev_o_rech_no_bloq
        )
        return summary, "REQUIERE_REVISION", motivo

    obs = [r for r in rules if r["resultado"] == "OBS"]
    if obs:
        motivo = "Aprobado con observaciones: " + "; ".join(
            f"{r['codigo']}: {r['observacion'] or r['campo']}" for r in obs
        )
        return summary, "APROBADO", motivo

    return summary, "APROBADO", "Todas las validaciones pasaron exitosamente"


_PRIORIDAD_RESULTADO = {"N/A": 0, "OK": 1, "OBS": 2, "REV": 3, "RECH": 4}


def evaluar_validacion_documental(
    *,
    tipo_documento_ia: str,
    document_data: dict[str, Any] | None = None,
    reglas_ia: list[dict[str, Any]] | dict[str, Any] | None = None,
    sujeto_esperado: dict[str, Any] | None = None,
    empresa_esperada: dict[str, Any] | None = None,
    cedula_aprobada: dict[str, Any] | None = None,
    padron_aprobado: dict[str, Any] | None = None,
    anexos_vigentes: list[dict[str, Any]] | None = None,
    override_faena: dict[str, Any] | None = None,
    equivalencias: list[dict[str, Any]] | None = None,
    portal_verificacion: dict[str, Any] | None = None,
    fecha_evaluacion: date | None = None,
    origen_llm: bool | None = None,
) -> dict[str, Any]:
    """Ejecuta el motor común sobre cualquier documento y produce el contrato único."""
    hoy = fecha_evaluacion or date.today()
    doc_data = copy.deepcopy(document_data or {})
    sujeto_esperado = sujeto_esperado or {}
    empresa_esperada = empresa_esperada or {}
    pauta_key = _TIPO_A_PAUTA.get(tipo_documento_ia, "documento_laboral")
    familia = _TIPO_A_FAMILIA.get(tipo_documento_ia, "TRABAJADORES_DOCUMENTOS")

    reglas_def, parametros, reglas_activas = resolver_pauta_efectiva(
        tipo_documento_ia, override_faena
    )

    # Indexar evaluaciones provistas por el LLM o extractor (solo resultado y observacion;
    # el flag `bloqueante` SIEMPRE viene de `reglas_def` de producto/faena).
    ia_map: dict[str, dict[str, Any]] = {}
    if isinstance(reglas_ia, list):
        for item in reglas_ia:
            if isinstance(item, dict) and item.get("codigo"):
                ia_map[str(item["codigo"]).upper()] = item
    elif isinstance(reglas_ia, dict):
        for cod, item in reglas_ia.items():
            if isinstance(item, dict):
                ia_map[str(cod).upper()] = item

    # Si origen_llm es True (Gemini), toda regla omitida pasa fail-safe a REV.
    # Si origen_llm es False (ej. SimulatedReviewer/extractores), las omitidas quedan OK.
    # Si origen_llm es None (llamada directa con reglas_ia), mantiene comportamiento previo.
    if origen_llm is False:
        llm_evaluo = False
    elif origen_llm is True:
        llm_evaluo = True
    else:
        llm_evaluo = isinstance(reglas_ia, (list, dict)) and len(ia_map) > 0
    estado_por_cod: dict[str, str] = {}
    obs_por_cod: dict[str, str] = {}
    determinista_por_cod: set[str] = set()
    for rd in reglas_def:
        raw = ia_map.get(rd.codigo, {})
        has_raw = rd.codigo in ia_map
        raw_res = str(raw.get("resultado") or "").upper().strip()
        if not has_raw:
            raw_res = "REV" if llm_evaluo else "OK"
            default_obs = "Regla omitida en evaluación IA; requiere revisión" if llm_evaluo else ""
        elif raw_res in ESTADOS_REGLA:
            default_obs = str(raw.get("observacion") or "")
        elif raw_res in ("WARN", "WARNING"):
            raw_res = "OBS"
            default_obs = str(raw.get("observacion") or "")
        elif raw_res == "ERROR":
            raw_res = "RECH"
            default_obs = str(raw.get("observacion") or "")
        else:
            raw_res = "REV"
            default_obs = str(raw.get("observacion") or "Resultado IA no reconocido; requiere revisión")

        # Si Nivel 3 desactivó explícitamente la regla -> N/A
        if reglas_activas.get(rd.codigo) is False:
            estado_por_cod[rd.codigo] = "N/A"
            obs_por_cod[rd.codigo] = "Regla desactivada por configuración de faena"
        else:
            estado_por_cod[rd.codigo] = raw_res
            obs_por_cod[rd.codigo] = default_obs

    def set_rule(cod: str, res: str, obs: str) -> None:
        if reglas_activas.get(cod) is False or cod not in estado_por_cod:
            return
        if cod in determinista_por_cod:
            prio_actual = _PRIORIDAD_RESULTADO.get(estado_por_cod[cod], 0)
            prio_nuevo = _PRIORIDAD_RESULTADO.get(res, 0)
            if prio_actual > prio_nuevo:
                if obs and obs not in obs_por_cod[cod]:
                    obs_por_cod[cod] = f"{obs_por_cod[cod]}; {obs}" if obs_por_cod[cod] else obs
                return
        estado_por_cod[cod] = res
        obs_por_cod[cod] = obs
        determinista_por_cod.add(cod)

    # ------------------------------------------------------------------------
    # 1. Validación de Identidad y Validación Cruzada por Titular (H1, H2)
    # ------------------------------------------------------------------------
    es_equipo = familia.startswith("EQUIPOS_")
    if es_equipo:
        pat_doc = normalizar_patente(_extraer_patente_documento(doc_data))
        pat_esp = normalizar_patente(
            (padron_aprobado or {}).get("patente") or sujeto_esperado.get("patente")
        )
        if pat_esp and pat_doc:
            if pat_doc != pat_esp:
                set_rule("ID01", "RECH", f"Patente del documento ({pat_doc}) no coincide con el equipo ({pat_esp})")
                set_rule("EQD01", "RECH", f"Patente del documento ({pat_doc}) no coincide con {pat_esp}")
                set_rule("EQC01", "RECH", f"Patente del certificado ({pat_doc}) no coincide con {pat_esp}")
            else:
                set_rule("ID01", "OK", "")
                set_rule("EQD01", "OK", "")
                set_rule("EQC01", "OK", "")
        if padron_aprobado and pauta_key in ("equipo_doc", "equipo_cert"):
            vin_doc = normalizar_texto(doc_data.get("VIN") or doc_data.get("vin") or doc_data.get("chasis"))
            vin_ref = normalizar_texto(padron_aprobado.get("vin"))
            if vin_doc and vin_ref and vin_doc != vin_ref:
                set_rule("EQD02", "REV", f"VIN/chasis ({vin_doc}) difiere del padrón aprobado ({vin_ref})")
    elif familia.startswith("TRABAJADORES_"):
        rut_doc = _extraer_rut_documento(doc_data, familia)
        rut_esp = (cedula_aprobada or {}).get("rut") or sujeto_esperado.get("rut")
        if rut_esp and rut_doc:
            if normalizar_rut_compacto(rut_doc) != normalizar_rut_compacto(rut_esp):
                msg_rut = f"RUT del documento ({rut_doc}) no coincide con el trabajador esperado ({rut_esp})"
                set_rule("ID01", "RECH", msg_rut)
                set_rule("CED02", "RECH", msg_rut)
                set_rule("LIC01", "RECH", msg_rut)
                set_rule("HVC01", "RECH", msg_rut)
                set_rule("ANT01", "RECH", msg_rut)
                set_rule("EXA02", "RECH", msg_rut)
                set_rule("CUR02", "RECH", msg_rut)
                set_rule("TRAB02", "RECH", msg_rut)  # H2
            else:
                set_rule("ID01", "OK", "")
                for c_rut in ("CED02", "LIC01", "HVC01", "ANT01", "EXA02", "CUR02", "TRAB02"):
                    set_rule(c_rut, "OK", "")

        nom_doc = _extraer_nombre_documento(doc_data, familia)
        nom_cedula = (cedula_aprobada or {}).get("nombre_completo")
        nom_ficha = sujeto_esperado.get("nombre")

        # H2 en Contrato: comparar TRAB01 contra sujeto esperado (o cédula aprobada)
        nom_ref_contrato = nom_cedula or nom_ficha
        if pauta_key == "contrato" and nom_doc and nom_ref_contrato:
            coincide, detalle = nombres_coinciden(nom_doc, nom_ref_contrato)
            if not coincide:
                msg_nom = f"Nombre del contrato ({nom_doc}) no coincide con el trabajador esperado ({nom_ref_contrato})"
                set_rule("TRAB01", "RECH", msg_nom)
                set_rule("ID02", "RECH", msg_nom)
            else:
                set_rule("TRAB01", "OK", "")
                set_rule("ID02", "OK", "")
        elif nom_doc and nom_cedula and tipo_documento_ia != "cedula":
            # H1: Validación cruzada contra la Cédula aprobada del mismo titular
            coincide, detalle = nombres_coinciden(nom_doc, nom_cedula)
            if not coincide:
                msg_cruce = (
                    f"Discrepancia de nombre respecto a cédula aprobada: "
                    f"documento indica '{nom_doc}' vs cédula '{nom_cedula}'"
                )
                set_rule("ID02", "REV", msg_cruce)
                set_rule("EXA03", "REV", msg_cruce)
                set_rule("CUR02", "REV", msg_cruce)
            else:
                set_rule("ID02", "OK", "")
                set_rule("EXA03", "OK", "")
        elif nom_doc and nom_ficha:
            coincide, _ = nombres_coinciden(nom_doc, nom_ficha)
            if not coincide:
                msg_ficha = f"Nombre del documento ({nom_doc}) difiere de la ficha ({nom_ficha})"
                set_rule("ID02", "REV", msg_ficha)
                set_rule("CED06", "RECH", msg_ficha)
            else:
                set_rule("ID02", "OK", "")
                set_rule("CED06", "OK", "")
    elif familia == "EMPRESA":
        rut_emp_doc = _extraer_rut_documento(doc_data, familia)
        rut_emp_esp = empresa_esperada.get("rut")
        if rut_emp_doc and rut_emp_esp:
            if normalizar_rut_compacto(rut_emp_doc) != normalizar_rut_compacto(rut_emp_esp):
                msg_emp = f"RUT de empresa ({rut_emp_doc}) no coincide con el contratista ({rut_emp_esp})"
                set_rule("ID01", "RECH", msg_emp)
                set_rule("EMPR01", "RECH", msg_emp)
            else:
                set_rule("ID01", "OK", "")
                set_rule("EMPR01", "OK", "")
        nom_emp_doc = _extraer_nombre_documento(doc_data, familia)
        nom_emp_esp = empresa_esperada.get("razon_social") or empresa_esperada.get("nombre")
        if nom_emp_doc and nom_emp_esp:
            coincide_emp, _ = nombres_coinciden(nom_emp_doc, nom_emp_esp)
            if not coincide_emp:
                msg_nemp = f"Razón social ({nom_emp_doc}) difiere del contratista ({nom_emp_esp})"
                set_rule("ID02", "REV", msg_nemp)
                set_rule("EMPR02", "REV", msg_nemp)
            else:
                set_rule("ID02", "OK", "")
                set_rule("EMPR02", "OK", "")

    # ------------------------------------------------------------------------
    # 2. Vigencia general y específica
    # ------------------------------------------------------------------------
    f_venc = _extraer_fecha_vencimiento(doc_data)
    if f_venc is not None and pauta_key != "contrato":
        if f_venc < hoy:
            msg_v = f"Documento vencido el {f_venc.isoformat()}"
            set_rule("VIG01", "RECH", msg_v)
            for cod_v in ("CED04", "LIC04", "PAS03", "EXA08", "CUR07", "EQD04", "EQC07", "EMPR04"):
                set_rule(cod_v, "RECH", msg_v)
        else:
            dias = (f_venc - hoy).days
            if dias <= 30:
                set_rule("VIG01", "OBS", f"Documento vigente con {dias} días restantes (vence {f_venc.isoformat()})")
            else:
                set_rule("VIG01", "OK", f"Vigente hasta {f_venc.isoformat()} ({dias} días restantes)")

    # ------------------------------------------------------------------------
    # 3. Reglas específicas de Contrato: H3 (unidad), H4 (Ley 40h), H5 (plazo fijo)
    # ------------------------------------------------------------------------
    if pauta_key == "contrato":
        # H3 + H4: JORN03
        jornada = doc_data.get("jornada") if isinstance(doc_data.get("jornada"), dict) else {}
        duracion_raw = jornada.get("duracion_semanal") or doc_data.get("duracion_jornada")
        dist_raw = jornada.get("distribucion")
        art22 = jornada.get("art22_excluido")
        if art22 is True:
            set_rule("JORN03", "N/A", "Trabajador excluido de límite de jornada (Art. 22 inc. 2°)")
            set_rule("JORN04", "OK", "Exclusión Art. 22 inc. 2° declarada")
        elif duracion_raw is not None:
            horas_sem, detalle_norm = normalizar_jornada_a_semanal(duracion_raw, dist_raw)
            # Fecha de referencia para Ley 40 horas (H4): rige según la fecha de evaluación vigente
            fecha_ref_ley = fecha_evaluacion or hoy
            limite = limite_jornada_legal_semanal(fecha_ref_ley)
            if horas_sem is not None:
                # Guardamos el valor normalizado en documentData para trazabilidad UI
                jornada["duracion_semanal_normalizada_hrs"] = horas_sem
                jornada["limite_legal_aplicado_hrs"] = limite
                doc_data["jornada"] = jornada
                if horas_sem > limite:
                    set_rule(
                        "JORN03",
                        "RECH",
                        f"Jornada de {horas_sem:g} hrs/semana ({detalle_norm}) excede el límite legal de {limite} hrs/semana (Ley 40 Horas)",
                    )
                else:
                    set_rule(
                        "JORN03",
                        "OK",
                        f"Jornada normalizada a {horas_sem:g} hrs/semana dentro del límite legal de {limite} hrs/semana",
                    )

        # H5: Contrato a plazo fijo con fecha de término vencida sin anexo de prórroga vigente
        vig = doc_data.get("vigencia") if isinstance(doc_data.get("vigencia"), dict) else {}
        tipo_ct = normalizar_texto(vig.get("tipo_contrato"))
        f_termino = _parse_fecha(vig.get("fecha_termino"))
        if "PLAZO FIJO" in tipo_ct and f_termino is not None:
            if f_termino < hoy:
                tiene_anexo_vigente = any(
                    a.get("pasa_indefinido") is True
                    or (_parse_fecha(a.get("fecha_termino")) is not None and _parse_fecha(a.get("fecha_termino")) >= hoy)
                    for a in (anexos_vigentes or [])
                )
                if not tiene_anexo_vigente:
                    msg_pf = (
                        f"Contrato a plazo fijo vencido el {f_termino.isoformat()} "
                        "sin anexo de prórroga o paso a indefinido vigente"
                    )
                    set_rule("VIG01", "RECH", msg_pf)
                    set_rule("VIG03", "RECH", msg_pf)
                    set_rule("VIG04", "RECH", msg_pf)
                else:
                    set_rule("VIG01", "OK", f"Plazo fijo respaldado por anexo vigente (vencimiento original {f_termino.isoformat()})")
                    set_rule("VIG03", "OK", "Plazo fijo prorrogado mediante anexo vigente")
                    set_rule("VIG04", "OK", "Vigencia respaldada por anexo")

        # Si exclusividad no fue activada por faena ni evaluada explícitamente como activa, queda N/A
        excl_activa = any(reglas_activas.get(f"EXCL0{i}") is True for i in range(1, 7))
        if not excl_activa:
            for i in range(1, 7):
                cod_e = f"EXCL0{i}"
                ia_res_e = str((ia_map.get(cod_e) or {}).get("resultado") or "").upper()
                if cod_e not in ia_map or ia_res_e in ("", "N/A"):
                    estado_por_cod[cod_e] = "N/A"
                    obs_por_cod[cod_e] = ""

    # ------------------------------------------------------------------------
    # 4. Exámenes médicos: H7 (portal < 95% o páginas) y H8 (alcohol/drogas positivo)
    # ------------------------------------------------------------------------
    if familia == "TRABAJADORES_EXAMENES":
        emisor = normalizar_texto(doc_data.get("NombreEmisor") or doc_data.get("emisor")).lower()
        if emisor and any(e in emisor for e in EMISORES_EXAMEN_AUTORIZADOS):
            set_rule("EXA01", "OK", "")

        # Nivel 3: Equivalencias de exámenes / baterías médicas (EXA05)
        nombre_examen = (
            doc_data.get("NombreExamen")
            or doc_data.get("nombre_examen")
            or doc_data.get("tipo_examen")
            or doc_data.get("NombreRiesgoEvaluado")
        )
        if nombre_examen and equivalencias is not None:
            ex_norm = normalizar_texto(nombre_examen)
            match_ex = next(
                (
                    eq
                    for eq in equivalencias
                    if eq.get("confirmado", True)
                    and eq.get("familia") in ("EXAMENES", "TRABAJADORES_EXAMENES")
                    and normalizar_texto(eq.get("nombre_detectado")) == ex_norm
                ),
                None,
            )
            if match_ex:
                doc_data["examen_canonico"] = match_ex.get("nombre_canonico")
                set_rule("EXA05", "OK", f"Examen equivalente confirmado a '{match_ex.get('nombre_canonico')}'")

        # H7: Verificación contra portal oficial
        vp = portal_verificacion or doc_data.get("valida_portal")
        if isinstance(vp, dict):
            comp = vp.get("comparison") if isinstance(vp.get("comparison"), dict) else {}
            fc = vp.get("field_comparison") if isinstance(vp.get("field_comparison"), dict) else {}
            campos_ok = fc.get("isValid") if "isValid" in fc else vp.get("validated")
            sims: list[float] = []
            for key_s in ("text_similarity", "containment"):
                val_s = comp.get(key_s)
                if val_s is not None:
                    try:
                        sims.append(float(val_s))
                    except (TypeError, ValueError):
                        pass
            sim = min(sims) if sims else None
            try:
                umbral = float(comp.get("containment_threshold", 95))
            except (TypeError, ValueError):
                umbral = 95.0
            pages_match = comp.get("pages_match", True)
            p_orig = comp.get("original_pages")
            p_port = comp.get("portal_pages")

            if campos_ok is False:
                set_rule("EXA09", "RECH", "Discrepancia de campos al verificar contra portal del emisor")
                set_rule("AUT01", "RECH", "No auténtico según portal del emisor")
            elif campos_ok is True:
                if (sim is not None and sim < umbral) or pages_match is False:
                    detalles = []
                    if sim is not None and sim < umbral:
                        detalles.append(f"similitud textual {sim:g}% < umbral {umbral:g}%")
                    if pages_match is False:
                        detalles.append(f"páginas difieren ({p_orig} vs {p_port})")
                    msg_portal = (
                        "Aprobado por coincidencia de campos contra portal oficial, pero con observación de auditoría: "
                        + ", ".join(detalles)
                    )
                    set_rule("EXA09", "OBS", msg_portal)
                    set_rule("AUT01", "OBS", msg_portal)
                else:
                    set_rule("EXA09", "OK", "Verificado auténtico contra portal del emisor")
                    set_rule("AUT01", "OK", "Verificado auténtico contra portal del emisor")
            else:
                set_rule("EXA09", "REV", "Verificación contra portal no concluyente o pendiente")
                set_rule("AUT01", "REV", "Verificación contra portal no concluyente o pendiente")

        # Restricciones médicas -> EXA07 a REV (o según faena)
        restr = doc_data.get("Restricciones") or doc_data.get("restricciones")
        if restr and str(restr).strip().lower() not in ("ninguna", "sin restricciones", "no", "none"):
            set_rule("EXA07", "REV", "El examen presenta restricciones médicas que requieren revisión")

        # Conclusión clínica: NO APTO -> RECH; positivo drogas/alcohol en cualquier examen -> REV
        conc = normalizar_texto(doc_data.get("Conclusion") or doc_data.get("conclusion"))
        panel_pos = doc_data.get("Positivo") if "Positivo" in doc_data else doc_data.get("positivo")
        pos_flag = panel_pos is True or str(panel_pos or "").strip().lower() in ("true", "si", "sí", "1", "positivo")
        panel_sust = doc_data.get("ResultadoSustancias") or doc_data.get("resultado_sustancias") or doc_data.get("PanelDrogas") or doc_data.get("panel_drogas")
        if isinstance(panel_sust, dict):
            pos_flag = pos_flag or any("POSITIV" in normalizar_texto(str(v)) or v is True for v in panel_sust.values())
        if "NO APTO" in conc or "NO_APTO" in conc:
            set_rule("EXA06", "RECH", "Conclusión clínica indica NO APTO")
        elif pos_flag or "POSITIV" in conc:
            set_rule("EXA06", "REV", "Resultado positivo detectado en examen de alcohol y drogas")

        # Altitud geográfica vs parámetro Nivel 3
        alt_min = parametros.get("altitud_geografica_msnm")
        alt_doc = doc_data.get("AltitudEvaluadaMsnm") or doc_data.get("altitud_msnm")
        if alt_min is not None and alt_doc is not None:
            try:
                if float(alt_doc) < float(alt_min):
                    set_rule("FAE01", "RECH", f"Altitud evaluada ({alt_doc} msnm) inferior al mínimo de faena ({alt_min} msnm)")
            except (TypeError, ValueError):
                pass

    # ------------------------------------------------------------------------
    # 5. Cursos: Horas mínimas (CUR04), Modalidad (CUR06) y Equivalencias (Nivel 3)
    # ------------------------------------------------------------------------
    if familia == "TRABAJADORES_CURSOS":
        horas_min = parametros.get("horas_minimas_curso")
        horas_doc = doc_data.get("horas") or doc_data.get("duracion_horas")
        if horas_min is not None and horas_doc is not None:
            try:
                if float(horas_doc) < float(horas_min):
                    set_rule("CUR04", "RECH", f"Duración de {horas_doc}h menor al mínimo exigido ({horas_min}h)")
                else:
                    set_rule("CUR04", "OK", f"Cumple duración mínima ({horas_doc}h >= {horas_min}h)")
            except (TypeError, ValueError):
                pass

        if parametros.get("requiere_parte_practica"):
            mod = normalizar_texto(doc_data.get("modalidad"))
            if mod and "PRACTIC" not in mod and "TEORICO" not in mod:
                set_rule("CUR06", "RECH", "La faena exige modalidad teórico-práctica")

        nombre_curso = doc_data.get("nombre_curso") or doc_data.get("curso")
        if nombre_curso and equivalencias is not None:
            n_norm = normalizar_texto(nombre_curso)
            match_eq = next(
                (
                    eq
                    for eq in equivalencias
                    if eq.get("confirmado", True)
                    and eq.get("familia") in (None, "CURSOS", "TRABAJADORES_CURSOS")
                    and normalizar_texto(eq.get("nombre_detectado")) == n_norm
                ),
                None,
            )
            if match_eq:
                doc_data["curso_canonico"] = match_eq.get("nombre_canonico")
                set_rule("CUR01", "OK", f"Equivalente confirmado a '{match_eq.get('nombre_canonico')}'")
            else:
                try:
                    conf_eq = float(doc_data.get("confianza_equivalencia") or 0.0)
                except (TypeError, ValueError):
                    conf_eq = 0.0
                if conf_eq < 0.85 and not doc_data.get("catalogo_exacto"):
                    set_rule(
                        "CUR01",
                        "REV",
                        f"Curso '{nombre_curso}' sin coincidencia confirmada en catálogo de equivalencias; requiere confirmación",
                    )

    # ------------------------------------------------------------------------
    # 6. Antigüedad HVC / Antecedentes / CAV y monto RC (Nivel 3)
    # ------------------------------------------------------------------------
    f_emision = _parse_fecha(doc_data.get("FechaEmision") or doc_data.get("fecha_emision"))
    if f_emision is not None:
        dias_ant = (hoy - f_emision).days
        if tipo_documento_ia == "hvc":
            try:
                max_hvc = int(parametros.get("antiguedad_max_dias_hvc", 30))
            except (TypeError, ValueError):
                max_hvc = 30
            if dias_ant > max_hvc:
                set_rule("HVC02", "RECH", f"HVC emitida hace {dias_ant} días (máximo {max_hvc} días)")
        elif tipo_documento_ia == "antecedentes":
            try:
                max_ant = int(parametros.get("antiguedad_max_dias_antecedentes", 60))
            except (TypeError, ValueError):
                max_ant = 60
            if dias_ant > max_ant:
                set_rule("ANT03", "RECH", f"Certificado emitido hace {dias_ant} días (máximo {max_ant} días)")

    if tipo_documento_ia == "seguro_rc" and parametros.get("monto_minimo_rc"):
        monto_doc = doc_data.get("monto_asegurado")
        if monto_doc is not None:
            try:
                if float(monto_doc) < float(parametros["monto_minimo_rc"]):
                    set_rule(
                        "FAE01",
                        "RECH",
                        f"Monto asegurado ({monto_doc}) inferior al mínimo de faena ({parametros['monto_minimo_rc']})",
                    )
            except (TypeError, ValueError):
                pass

    # ------------------------------------------------------------------------
    # 7. Ensamblar salida estándar única y garantizar coherencia (H6)
    # ------------------------------------------------------------------------
    rules_out: list[dict[str, Any]] = [
        {
            "codigo": rd.codigo,
            "campo": rd.campo,
            "resultado": estado_por_cod[rd.codigo],
            "bloqueante": rd.bloqueante,
            "observacion": obs_por_cod[rd.codigo],
        }
        for rd in reglas_def
    ]
    summary, status, motivo = calcular_resumen_y_estado(rules_out)

    return {
        "documentData": doc_data,
        "rules": rules_out,
        "summary": summary,
        "status": status,
        "motivo": motivo,
    }


# ============================================================================
# Hallazgo 8: Privacidad médica por rol
# ============================================================================
def _es_examen_medico(payload: dict[str, Any], tipo_documento_ia: str | None = None) -> bool:
    if tipo_documento_ia and _TIPO_A_FAMILIA.get(tipo_documento_ia) == "TRABAJADORES_EXAMENES":
        return True
    rules = payload.get("rules") or []
    if any(str(r.get("codigo", "")).startswith("EXA") for r in rules if isinstance(r, dict)):
        return True
    claves_indicadoras = _CAMPOS_MEDICOS_LOWER | {"nombreriesgoevaluado", "rutpaciente", "nombrepaciente"}
    for key_dd in ("documentData", "campos_extraidos"):
        dd = payload.get(key_dd)
        if isinstance(dd, dict) and any(str(k).lower() in claves_indicadoras for k in dd):
            return True
    return False


def _aptitud_sanitizada(doc_data: dict[str, Any], status: str | None) -> str:
    conc = normalizar_texto(doc_data.get("Conclusion") or doc_data.get("conclusion") or doc_data.get("resultado_examen"))
    pos = doc_data.get("Positivo") if "Positivo" in doc_data else doc_data.get("positivo")
    restr = doc_data.get("Restricciones") or doc_data.get("restricciones")
    has_restr = bool(restr and str(restr).strip().lower() not in ("ninguna", "sin restricciones", "no", "none"))
    if "NO APTO" in conc or status == "RECHAZADO":
        return "NO APTO"
    if (
        status == "REQUIERE_REVISION"
        or "PENDIENTE" in conc
        or "POSITIV" in conc
        or "RESTRICCION" in conc
        or has_restr
        or pos is True
        or str(pos or "").strip().lower() in ("true", "si", "sí", "1", "positivo")
    ):
        return "REQUIERE_REVISION"
    if "APTO" in conc or conc == "OK":
        return "APTO"
    return "APTO" if status == "APROBADO" else "REQUIERE_REVISION"


def _filtrar_allowlist_medica(doc_data: dict[str, Any]) -> dict[str, Any]:
    """Allowlist estricta H8: retiene solo identificación, emisor/folio, fechas y resumen de portal."""
    limpio: dict[str, Any] = {}
    for k, v in doc_data.items():
        kl = str(k).lower()
        if kl in _ALLOWLIST_DOC_MEDICO_LOWER:
            limpio[k] = v
        elif kl == "valida_portal" and isinstance(v, dict):
            comp = v.get("comparison") if isinstance(v.get("comparison"), dict) else {}
            fc = v.get("field_comparison") if isinstance(v.get("field_comparison"), dict) else {}
            limpio[k] = {
                "validated": bool(v.get("validated", fc.get("isValid", False))),
                "comparison": {
                    ck: comp[ck]
                    for ck in (
                        "text_similarity",
                        "containment",
                        "containment_threshold",
                        "pages_match",
                        "original_pages",
                        "portal_pages",
                    )
                    if ck in comp
                },
                "field_comparison": {"isValid": fc.get("isValid")} if "isValid" in fc else {},
            }
    return limpio


def sanitizar_privacidad_medica(
    payload: dict[str, Any],
    user_role: str | None,
    tipo_documento_ia: str | None = None,
) -> dict[str, Any]:
    """Oculta glosa clínica, restricciones y resultados positivos a roles no autorizados (H8).

    Solo expone aptitud (APTO / NO APTO / REQUIERE_REVISION) y fechas de vigencia.
    """
    if user_role in ROLES_SALUD_AUTORIZADOS:
        return payload
    if not _es_examen_medico(payload, tipo_documento_ia):
        return payload

    out = copy.deepcopy(payload)
    aviso_priv = "Información médica reservada (solo se informa aptitud y vigencia)"
    val_status = out.get("validation_status")
    raw_status = out.get("status")
    status_actual = val_status if val_status in ESTADOS_GLOBALES else (
        raw_status if raw_status in ESTADOS_GLOBALES else None
    )
    aptitud_global = None

    for key_dd in ("documentData", "campos_extraidos"):
        doc_data = out.get(key_dd)
        if isinstance(doc_data, dict):
            aptitud = _aptitud_sanitizada(doc_data, status_actual)
            aptitud_global = aptitud_global or aptitud
            limpio = _filtrar_allowlist_medica(doc_data)
            limpio["Conclusion"] = aptitud
            limpio["privacidad_medica_aplicada"] = True
            out[key_dd] = limpio

    rules = out.get("rules")
    if isinstance(rules, list):
        for r in rules:
            if isinstance(r, dict) and str(r.get("codigo", "")) not in _REGLAS_NO_CLINICAS:
                if r.get("observacion") or r.get("resultado") != "OK":
                    r["observacion"] = aviso_priv

    hallazgos = out.get("hallazgos")
    if isinstance(hallazgos, list):
        for h in hallazgos:
            if isinstance(h, dict) and str(h.get("codigo", "")) not in _REGLAS_NO_CLINICAS:
                h["mensaje"] = aviso_priv
                h["valor_detectado"] = aptitud_global or "RESERVADO"
                h["valor_esperado"] = None

    if isinstance(out.get("motivo"), str) and out["motivo"]:
        tiene_clinico_no_ok = any(
            isinstance(r, dict)
            and str(r.get("codigo", "")) not in _REGLAS_NO_CLINICAS
            and r.get("resultado") != "OK"
            for r in (rules or [])
        )
        if tiene_clinico_no_ok or not rules or any(
            w in out["motivo"].lower()
            for w in ("positiv", "restric", "glosa", "thc", "cocain", "droga", "alcohol")
        ):
            out["motivo"] = aviso_priv

    if isinstance(out.get("accion_aplicada"), str) and out["accion_aplicada"]:
        out["accion_aplicada"] = "Revisión médica procesada (detalle clínico reservado para roles autorizados)"

    if isinstance(out.get("validation"), dict):
        out["validation"] = sanitizar_privacidad_medica(
            out["validation"], user_role, tipo_documento_ia=tipo_documento_ia
        )

    return out


# ============================================================================
# Mapeo compatibilidad hacia/desde `ResultadoIA` y `IaReview` legado
# ============================================================================
def estado_v2_a_resultado_legado(status_v2: str, summary: dict[str, int]) -> str:
    if status_v2 == "RECHAZADO":
        return "con_errores"
    if status_v2 == "REQUIERE_REVISION" or summary.get("OBS", 0) > 0:
        return "con_observaciones"
    return "validado"


def rules_a_hallazgos_legado(rules: list[dict[str, Any]], doc_data: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Convierte rules v2 a filas de `ia_hallazgos` preservando compatibilidad."""
    hallazgos: list[dict[str, Any]] = []
    for r in rules:
        res = r.get("resultado")
        if res == "RECH":
            tipo = "error" if r.get("bloqueante") else "warning"
        elif res in ("OBS", "REV"):
            tipo = "warning"
        else:
            continue
        hallazgos.append(
            {
                "tipo": tipo,
                "codigo": r["codigo"],
                "mensaje": r.get("observacion") or f"{r['campo']}: {res}",
                "campo": r.get("campo"),
                "valor_detectado": None,
                "valor_esperado": None,
            }
        )
    if not hallazgos:
        hallazgos.append(
            {
                "tipo": "info",
                "codigo": "VALIDACION_OK",
                "mensaje": "Todas las validaciones pasaron exitosamente.",
                "campo": None,
                "valor_detectado": None,
                "valor_esperado": None,
            }
        )
    return hallazgos

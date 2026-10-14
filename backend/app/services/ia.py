"""Revisión IA de documentos: interfaz + implementación simulada y adaptador Claude.

La simulada replica el comportamiento del wireframe (hallazgos aleatorios pero
deterministas por archivo). El adaptador Claude queda listo: se activa con
IA_BACKEND=claude y ANTHROPIC_API_KEY.
"""

import hashlib
import random
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

logger = logging.getLogger("acredittia.ia")

from ..config import settings
from ..models import Documento, DocumentoArchivo, IaHallazgo, IaReview


@dataclass
class Hallazgo:
    tipo: str  # error | warning | info
    codigo: str
    mensaje: str


@dataclass
class ResultadoIA:
    resultado: str  # validado | con_observaciones | con_errores
    confianza: float
    campos_extraidos: dict = field(default_factory=dict)
    hallazgos: list[Hallazgo] = field(default_factory=list)


ERRORES = [
    ("DOC_ILEGIBLE", "Documento ilegible: resolución inferior a 150 DPI."),
    ("FIRMA_NO_ENCONTRADA", "No se encontró firma en el documento."),
    ("VENCIMIENTO_AUSENTE", "No se detectó fecha de vencimiento."),
    ("RUT_NO_COINCIDE", "El RUT del documento no coincide con el del sujeto."),
    ("SELLO_NO_RECONOCIDO", "Sello o timbre del organismo emisor no reconocido."),
]
WARNINGS = [
    ("EMISION_ANTIGUA", "El documento fue emitido hace más de 60 días."),
    (
        "NOMBRE_DIFIERE",
        "El nombre difiere levemente (posible tilde u orden de apellidos).",
    ),
    ("FORMATO_NO_PDF", "Formato de imagen; se recomienda PDF para mejor trazabilidad."),
    (
        "FONDO_FOTO_INVALIDO",
        "La fotografía tiene fondo de color; SIGA exige fondo blanco.",
    ),
]
INFOS = [
    ("DOC_RECONOCIDO", "Tipo de documento reconocido correctamente."),
    ("QR_VERIFICADO", "Código QR verificado contra el registro emisor."),
    ("RESOLUCION_OK", "Resolución 240 DPI, sin señales de alteración."),
]


class IAReviewer(ABC):
    @abstractmethod
    def revisar(
        self, contenido: bytes, filename: str, doc: Documento, contexto: str
    ) -> ResultadoIA: ...


class SimulatedReviewer(IAReviewer):
    """Determinista por archivo: mismo archivo → mismo resultado."""

    def revisar(
        self, contenido: bytes, filename: str, doc: Documento, contexto: str
    ) -> ResultadoIA:
        seed = int(
            hashlib.sha256(contenido[:4096] + filename.encode()).hexdigest()[:8], 16
        )
        rng = random.Random(seed)
        hallazgos = [Hallazgo("info", *rng.choice(INFOS))]
        roll = rng.random()
        if roll < 0.40:
            resultado = "validado"
        elif roll < 0.80:
            resultado = "con_observaciones"
            hallazgos.append(Hallazgo("warning", *rng.choice(WARNINGS)))
        else:
            resultado = "con_errores"
            hallazgos.append(Hallazgo("error", *rng.choice(ERRORES)))
            if rng.random() < 0.5:
                hallazgos.append(Hallazgo("warning", *rng.choice(WARNINGS)))
        return ResultadoIA(
            resultado=resultado,
            confianza=round(rng.uniform(0.82, 0.99), 3),
            campos_extraidos={"archivo": filename, "documento": doc.titulo},
            hallazgos=hallazgos,
        )


class ClaudeReviewer(IAReviewer):
    """Adaptador real: envía el documento a la API de Claude y estructura el resultado."""

    PROMPT = (
        "Eres un revisor de documentos de acreditación minera en Chile. Analiza el documento "
        "adjunto para el requisito '{titulo}' (contexto: {contexto}). Responde SOLO un JSON con: "
        '{{"resultado": "validado|con_observaciones|con_errores", "confianza": 0.0-1.0, '
        '"campos_extraidos": {{...}}, "hallazgos": [{{"tipo": "error|warning|info", '
        '"codigo": "SNAKE_CASE", "mensaje": "..."}}]}}. Verifica: legibilidad, firma/timbre, '
        "fechas de emisión y vencimiento, y coherencia de identidad."
    )

    def revisar(
        self, contenido: bytes, filename: str, doc: Documento, contexto: str
    ) -> ResultadoIA:
        import base64
        import json
        import urllib.request

        media = "application/pdf" if filename.lower().endswith(".pdf") else "image/jpeg"
        bloque = {
            "type": "document" if media == "application/pdf" else "image",
            "source": {
                "type": "base64",
                "media_type": media,
                "data": base64.b64encode(contenido).decode(),
            },
        }
        body = {
            "model": "claude-sonnet-5",
            "max_tokens": 1500,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        bloque,
                        {
                            "type": "text",
                            "text": self.PROMPT.format(
                                titulo=doc.titulo, contexto=contexto
                            ),
                        },
                    ],
                }
            ],
        }
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(body).encode(),
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
        texto = data["content"][0]["text"]
        parsed = json.loads(texto[texto.index("{") : texto.rindex("}") + 1])
        return ResultadoIA(
            resultado=parsed.get("resultado", "con_observaciones"),
            confianza=float(parsed.get("confianza", 0.8)),
            campos_extraidos=parsed.get("campos_extraidos", {}),
            hallazgos=[
                Hallazgo(h["tipo"], h["codigo"], h["mensaje"])
                for h in parsed.get("hallazgos", [])
            ],
        )


class NvidiaNimReviewer(IAReviewer):
    """Adaptador para Nvidia NIM (Llama 3.2 Vision)."""

    PROMPT = (
        "Eres un auditor estricto de acreditación minera en Chile. Analiza la imagen adjunta.\n"
        "REQUISITO ESPERADO: '{titulo}'\n"
        "CONTEXTO: {contexto}\n\n"
        "MÉTRICAS DE EVALUACIÓN:\n"
        "1. Correspondencia: ¿El documento de la imagen es efectivamente un(a) '{titulo}'? Si es otro tipo de documento, "
        "marca el resultado como 'con_errores' y genera un hallazgo de tipo 'error' indicando que no corresponde.\n"
        "2. Legibilidad: ¿El documento se puede leer claramente?\n"
        "3. Vigencia: Extrae 'fecha_emision' y 'fecha_vencimiento' si existen.\n"
        "4. Confianza: Calcula un número real entre 0.00 y 1.00 indicando qué tan seguro estás de tu lectura.\n\n"
        "Responde SOLO con un JSON válido usando estrictamente esta estructura:\n"
        '{{"resultado": "validado" | "con_observaciones" | "con_errores", "confianza": <float>, '
        '"campos_extraidos": {{}}, "hallazgos": [{{"tipo": "error" | "warning" | "info", '
        '"codigo": "SNAKE_CASE", "mensaje": "..."}}]}}'
    )

    def revisar(
        self, contenido: bytes, filename: str, doc: Documento, contexto: str
    ) -> ResultadoIA:
        import base64
        import json
        import urllib.request
        from urllib.error import HTTPError

        # Convertir a imagen si es PDF
        if filename.lower().endswith(".pdf"):
            try:
                import fitz  # PyMuPDF

                doc_pdf = fitz.open(stream=contenido, filetype="pdf")
                if len(doc_pdf) > 0:
                    page = doc_pdf.load_page(0)
                    pix = page.get_pixmap(dpi=150)
                    contenido = pix.tobytes("jpeg")
                doc_pdf.close()
            except Exception as e:
                logger.warning(
                    "No se pudo convertir el PDF a imagen con PyMuPDF: %s", e
                )
            media = "image/jpeg"
        else:
            media = (
                "image/jpeg"
                if filename.lower().endswith((".jpg", ".jpeg"))
                else "image/png"
            )

        b64_data = base64.b64encode(contenido).decode("utf-8")
        data_url = f"data:{media};base64,{b64_data}"

        prompt = self.PROMPT.format(titulo=doc.titulo, contexto=contexto)

        payload = {
            "model": "meta/llama-3.2-11b-vision-instruct",
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_url}},
                    ],
                }
            ],
            "max_tokens": 1024,
            "temperature": 0.1,
            "stream": False,
        }

        req = urllib.request.Request(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.nvidia_nim_api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read())
                # El modelo retorna el JSON en content
                content = body["choices"][0]["message"]["content"]

                logger.info(f"Respuesta bruta de Nvidia: {content}")

                # Buscar bloque JSON
                import re

                match = re.search(r"\{.*\}", content, re.DOTALL)
                if match:
                    json_str = match.group(0)
                else:
                    json_str = content

                try:
                    parsed = json.loads(json_str)
                except json.JSONDecodeError:
                    parsed = {
                        "resultado": "con_errores",
                        "confianza": 0.0,
                        "campos_extraidos": {},
                        "hallazgos": [
                            {
                                "tipo": "error",
                                "codigo": "MODEL_ERROR",
                                "mensaje": content[:200],
                            }
                        ],
                    }
        except HTTPError as e:
            err_msg = e.read().decode()
            raise RuntimeError(f"Error de Nvidia NIM {e.code}: {err_msg}") from e
        except Exception as e:
            raise RuntimeError(f"Error parseando respuesta JSON de Nvidia: {e}") from e

        return ResultadoIA(
            resultado=parsed.get("resultado", "con_errores"),
            confianza=float(parsed.get("confianza", 0.0)),
            campos_extraidos=parsed.get("campos_extraidos", {}),
            hallazgos=[
                Hallazgo(h["tipo"], h["codigo"], h["mensaje"])
                for h in parsed.get("hallazgos", [])
            ],
        )


def get_reviewer() -> IAReviewer:
    if settings.ia_backend == "nvidia" and settings.nvidia_nim_api_key:
        return NvidiaNimReviewer()
    if settings.ia_backend == "claude" and settings.anthropic_api_key:
        return ClaudeReviewer()
    return SimulatedReviewer()


def ejecutar_revision(
    db: Session,
    archivo: DocumentoArchivo,
    doc: Documento,
    contenido: bytes,
    contexto: str,
) -> IaReview:
    """Ejecuta la revisión (síncrona en dev; en producción iría a un worker)."""
    review = IaReview(
        company_id=doc.company_id,
        archivo_id=archivo.id,
        context=contexto,
        status="processing",
        started_at=datetime.now(timezone.utc),
    )
    db.add(review)
    db.flush()
    try:
        r = get_reviewer().revisar(contenido, archivo.filename, doc, contexto)
        review.resultado = r.resultado
        review.confianza = r.confianza
        review.campos_extraidos = r.campos_extraidos
        review.status = "done"
        for h in r.hallazgos:
            db.add(
                IaHallazgo(
                    review_id=review.id, tipo=h.tipo, codigo=h.codigo, mensaje=h.mensaje
                )
            )
    except Exception as e:  # noqa: BLE001
        review.status = "failed"
        review.error = str(e)[:500]
    review.finished_at = datetime.now(timezone.utc)
    archivo.ia_review_id = review.id
    return review


async def chat_with_ia(historial: list[dict]) -> str:
    """Responde a un chat segn el backend configurado (simulado, claude, nvidia)."""
    import json
    import httpx

    sys_prompt = {
        "role": "system",
        "content": (
            "Eres el asistente ACREDITTIA, un experto en prevención de riesgos mineros en Chile. Responde SIEMPRE con un JSON válido que contenga la propiedad 'respuesta' con tu mensaje al usuario. "
            "Si el usuario pide agregar o identificar requisitos desde un texto o archivo adjunto, SÉ ABSOLUTAMENTE EXHAUSTIVO, no omitas NINGUNO. Extrae el 100% de los requisitos listados. "
            "Clasifícalos de forma estricta y correcta en las siguientes 4 categorías "
            "y devuelve un objeto 'agregados' con estas llaves EXACTAS (como arreglos de strings): "
            "'empresa' (Requisitos corporativos. Ej: F30-1, Certificado de Mutual, Resoluciones Ambientales, Plan de Manejo de Residuos, Patente Comercial, etc.), "
            "'personal' (Requisitos para trabajadores humanos. Ej: Contrato de trabajo, Exámenes físicos/preocupacionales/psicosensométricos, Inducciones, Certificado de Antecedentes, Finiquito anterior, Certificación Rigger, etc.), "
            "'equipos' (Requisitos para vehículos, máquinas o herramientas. Ej: Revisión Técnica, SOAP, Permiso de Circulación, Mantención Preventiva, Certificación de Maquinaria, etc.), "
            "'licencia' (Requisitos específicos para conducir en faena. Ej: Licencia Municipal, Curso de Manejo a la defensiva, Hoja de vida del conductor). "
            "¡CUIDADO! Un examen médico NUNCA es de equipo. Una revisión técnica NUNCA es de trabajador. "
            "NUNCA dupliques el mismo requisito en múltiples categorías. Cada requisito pertenece EXCLUSIVAMENTE a UNA sola categoría. "
            "Si pide eliminar requisitos, usa la misma estructura en un objeto 'eliminados'. "
            "En 'agregados' incluye ÚNICAMENTE los requisitos nuevos que pide "
            "este mensaje, jamás los que ya vienen listados en el contexto. "
            "Si el usuario solo pide listar, mostrar o consultar (sin agregar "
            "ni eliminar), escribe la lista en 'respuesta' como texto y deja "
            "'agregados' y 'eliminados' vacíos. "
            "Responde SOLO con el objeto JSON, sin razonamiento ni texto antes o después. "
            "Ejemplo de salida:\n"
            "{\n"
            '  "respuesta": "He extraído y clasificado los requisitos:",\n'
            '  "agregados": {\n'
            '    "empresa": ["Certificado F30-1"],\n'
            '    "personal": ["Examen de altura", "Inducción", "Certificado de antecedentes"],\n'
            '    "equipos": ["Revisión técnica", "SOAP"],\n'
            '    "licencia": ["Curso de manejo en faena"]\n'
            "  }\n"
            "}"
        ),
    }
    messages = [sys_prompt] + historial

    if settings.ia_backend == "nvidia" and settings.nvidia_nim_api_key:
        api_key = settings.nvidia_nim_api_key
        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            # Sin response_format: gpt-oss con json_object devuelve content vacío
            # a veces; el prompt ya exige JSON y se extrae con regex abajo.
            "model": "openai/gpt-oss-20b",
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 4096,
        }

        has_image = any(isinstance(m.get("content"), list) for m in messages)
        if has_image:
            # Paso 1: visión solo transcribe (no respeta el esquema JSON).
            try:
                img_parts = []
                for m in messages:
                    if isinstance(m.get("content"), list):
                        img_parts += [
                            p for p in m["content"] if p.get("type") == "image_url"
                        ]
                async with httpx.AsyncClient() as vclient:
                    vr = await vclient.post(
                        url,
                        headers=headers,
                        json={
                            "model": "meta/llama-3.2-11b-vision-instruct",
                            "messages": [
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "text",
                                            "text": "Transcribe TODO el texto visible en esta imagen, línea por línea, sin agregar ni inventar nada.",
                                        },
                                        *img_parts,
                                    ],
                                }
                            ],
                            "temperature": 0.1,
                            "max_tokens": 2048,
                        },
                        timeout=120.0,
                    )
                    vr.raise_for_status()
                    texto_img = vr.json()["choices"][0]["message"].get("content") or ""
                # Paso 2: clasificar el texto con el modelo de texto (con reintento).
                messages = [
                    sys_prompt,
                    {
                        "role": "user",
                        "content": f"Extrae y clasifica estos requisitos:\n{texto_img}",
                    },
                ]
                payload["messages"] = messages
            except Exception:
                import traceback

                logger.error(
                    f"Error transcribiendo imagen con NIM: {traceback.format_exc()}"
                )
                return '{"respuesta": "Ocurri un error procesando tu mensaje con la IA Nvidia."}'
        async with httpx.AsyncClient() as client:
            # gpt-oss a veces responde sin content utilizable: reintentar una vez
            for intento in range(2):
                try:
                    r = await client.post(
                        url, headers=headers, json=payload, timeout=120.0
                    )
                    r.raise_for_status()
                    data = r.json()
                    # gpt-oss a veces responde solo con reasoning (content null)
                    msg = data["choices"][0]["message"]
                    content = msg.get("content") or msg.get("reasoning_content") or ""
                    # Extraer el primer objeto JSON válido (el modelo a veces
                    # antepone razonamiento en texto plano).
                    import json as _json

                    extraido = None
                    for _i, _ch in enumerate(content):
                        if _ch != "{":
                            continue
                        try:
                            _obj, _end = _json.JSONDecoder().raw_decode(content[_i:])
                        except Exception:
                            continue
                        if isinstance(_obj, dict) and (
                            "respuesta" in _obj
                            or "agregados" in _obj
                            or "eliminados" in _obj
                        ):
                            extraido = content[_i : _i + _end]
                            break
                    if extraido:
                        return extraido
                    if content.strip():
                        return content
                    logger.warning(
                        "NIM devolvió content vacío (intento %d)", intento + 1
                    )
                except Exception:
                    import traceback

                    logger.error(
                        f"Error llamando a NVIDIA NIM Chat: {traceback.format_exc()}"
                    )
                    break
            return '{"respuesta": "Ocurri un error procesando tu mensaje con la IA Nvidia."}'

    elif settings.ia_backend == "claude" and settings.anthropic_api_key:
        api_key = settings.anthropic_api_key
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        # Adapt Claude messages (no system prompt in messages array)
        claude_messages = [m for m in historial if m["role"] != "system"]
        payload = {
            "model": "claude-3-5-sonnet-20240620",
            "max_tokens": 1024,
            "system": sys_prompt["content"],
            "messages": claude_messages,
        }
        async with httpx.AsyncClient() as client:
            try:
                r = await client.post(url, headers=headers, json=payload, timeout=30.0)
                r.raise_for_status()
                data = r.json()
                return data["content"][0]["text"]
            except Exception as e:
                logger.error(f"Error llamando a Claude Chat: {e}")
                return '{"respuesta": "Ocurri un error procesando tu mensaje con la IA Claude."}'

    # Simulado
    return json.dumps(
        {
            "respuesta": "Mock IA: Entendido. (No estoy conectado a una IA real)",
            "empresa": ["Examen simulado empresa"],
            "personal": [],
            "equipos": [],
            "licencia": [],
        }
    )

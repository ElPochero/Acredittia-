# Spec: Motor Común y Pautas de Validación Documental por IA (v2)

## 1. Objetivo
Unificar todos los validadores documentales de Acredittia bajo un motor común con:
- Contrato JSON único de salida (`documentData`, `rules`, `summary`, `status`, `motivo`).
- Controles transversales (`TIPO01`, `DOC01..04`, `ID01..02`, `VIG01`, `AUT01`, `FIRM01`, `FAE01`) ejecutados antes de las reglas específicas del documento.
- Jerarquía de 3 niveles: Familias (Nivel 1), Pauta Maestra por documento con `bloqueante` definido por producto (Nivel 2), y Overrides/Equivalencias por Faena/Mandante (Nivel 3).
- Validación cruzada por titular usando la Cédula (trabajadores) o Padrón (equipos) aprobados como fuente de verdad.
- Corrección de los 8 hallazgos documentados (H1–H8) y privacidad médica por rol.

## 2. Comandos de Verificación
- Backend schema & unit/integration tests:
  `.venv\Scripts\python.exe -m pytest tests/platform/test_esquema.py tests/platform/test_validador_documental_v2.py`
- Backend full suite:
  `.venv\Scripts\python.exe -m pytest`
- Frontend type-check & build:
  `npx tsc --noEmit`

## 3. Estructura de Archivos Afectados
- `modelo_datos/20_motor_validacion_ia_v2.sql`: Migración SQL v20 (tablas `faena_reglas_validacion`, `equivalencias_validacion`, columnas en `requisito_templates`, `sujetos`, `ia_reviews`).
- `backend/app/models/platform.py`: Modelos ORM `FaenaReglaValidacion`, `EquivalenciaValidacion` y campos nuevos.
- `backend/app/services/platform/validador_documental.py`: Motor común, catálogo de reglas de 3 niveles, validación cruzada, fixes H1–H8 y sanitización médica.
- `backend/app/services/platform/ia.py` y `backend/app/services/platform/tasks.py`: Integración multimodal y persistencia del contrato v2 + actualización de `sujetos.datos_verificados`.
- `backend/app/routers/platform/ia.py`: Endpoints `/ia/validar-documento`, `/ia/pautas`, `/ia/equivalencias`, `/ia/revisiones/{job_id}/validacion` y sanitización por rol en `review_out`.
- `frontend/components/platform/ValidationResultPanel.tsx`: Visor de reglas, contadores `OK/OBS/RECH/N/A/REV`, tarjetas de identidad/portal y acordeones `Datos extraídos`.

## 4. Contrato JSON Estándar
```json
{
  "documentData": {},
  "rules": [
    {
      "codigo": "DOC01",
      "campo": "Legibilidad",
      "resultado": "OK | OBS | RECH | N/A | REV",
      "bloqueante": true,
      "observacion": "..."
    }
  ],
  "summary": { "OK": 0, "OBS": 0, "RECH": 0, "N/A": 0, "REV": 0, "total": 0 },
  "status": "APROBADO | RECHAZADO | REQUIERE_REVISION",
  "motivo": "..."
}
```

## 5. Criterios de Aceptación (H1–H8)
- **H1**: Discrepancia de nombre vs cédula aprobada (`ALFONSO` vs `ALFREDO`) -> `ID02 = REV`, `status = REQUIERE_REVISION`.
- **H2**: `TRAB01` y `TRAB02` en Contrato comparan contra sujeto esperado; si difieren -> `RECH` bloqueante.
- **H3**: Normalización de unidad de jornada en `JORN03` (horas mensuales -> semanales).
- **H4**: Límite legal `JORN03` parametrizado por fecha según Ley 40 Horas (`44h` desde `2024-04-26`, `42h` desde `2026-04-26`, `40h` desde `2028-04-26`).
- **H5**: Contrato a plazo fijo vencido sin anexo de prórroga vigente -> `VIG03`/`VIG04 = RECH`.
- **H6**: Todo `RECHAZADO` tiene al menos una regla `RECH` con `bloqueante = true`, reflejada en `summary.RECH` y `motivo`.
- **H7**: Portal ACHS (`EXA09`/`AUT01`) aprobado por campos pero con similitud < 95% o distinto conteo de páginas -> `OBS` auditable.
- **H8**: Privacidad médica: roles no autorizados (`visor`, `contract_admin`, `adc`) reciben solo aptitud (`APTO` / `NO APTO` / `REQUIERE_REVISION`) y vigencia; positivos en alcohol/drogas marcan `REQUIERE_REVISION`.

# Acredittia — Plataforma de Acreditación con IA

Plataforma inteligente de acreditación de contratistas para faenas mineras, energéticas e industriales en Chile.

## 🚀 Tecnologías

- **Backend**: Python 3.12 + FastAPI + SQLAlchemy 2.0 (37 tablas PostgreSQL).
- **Frontend**: Next.js 14 + React + TypeScript + Vanilla CSS / TailwindCSS.
- **Base de Datos**: PostgreSQL 16 con migraciones automáticas (`migrate.run`) y soporte RLS.
- **IA**: Motor de revisión documental inteligente para licencias, exámenes de salud, inducciones y contratos.

---

## 📁 Estructura del Proyecto

```
Acredittia/
├── backend/               # Servidor FastAPI & Base de Datos
│   ├── app/
│   │   ├── main.py        # Servidor principal, CORS, middlewares y routers
│   │   ├── models.py      # Mapeo ORM de SQLAlchemy (37 tablas)
│   │   ├── database.py    # Conexión, RLS y aplicación de esquema
│   │   ├── security.py    # JWT, hashing de contraseñas y validación módulo 11 de RUT
│   │   ├── seeds.py       # Datos iniciales para pruebas (contratos, trabajadores, vehículos, etc.)
│   │   └── routers/       # Auth, Admin, Contratos, Sujetos, Documentos, Alertas, etc.
│   └── migrate/           # Script de migración autónomo (python -m migrate.run)
├── frontend/              # Aplicación Web Next.js 14
│   ├── app/               # Enrutamiento Next App Router (/login, /dashboard, /contratos, etc.)
│   ├── components/        # Componentes UI (Sidebar, AppHeader, Landing, etc.)
│   └── lib/               # Cliente API y utilidades (cliente.ts, api.ts)
└── docker-compose.yml     # Orquestación Docker para producción y desarrollo
```

---

## 💻 Cómo Ejecutar el Proyecto

### Opción 1: Con Docker Compose (Recomendado)

Requisito: **Docker Desktop** instalado y en ejecución.

```bash
docker-compose up --build
```

- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **Documentación OpenAPI**: `http://localhost:8000/docs`

---

### Opción 2: Ejecución Local en Desarrollo (Sin Docker)

#### 1. Backend (FastAPI)
```bash
cd backend

# Crear entorno virtual e instalar dependencias
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Aplicar migración de base de datos
python -m migrate.run

# Iniciar servidor backend
uvicorn app.main:app --reload --port 8000
```

#### 2. Frontend (Next.js)
```bash
cd frontend

# Instalar dependencias y levantar entorno de desarrollo
npm install
npm run dev
```

---

## 🔑 Cuentas Semilla Iniciales

| Rol | Email | Contraseña |
|---|---|---|
| **Administrador** | `admin@acredittia.cl` | `Admin2026!` |
| **Empresa Demo** | `demo@acredittia.cl` | `Demo2026!` |

*También puedes registrar una empresa nueva directamente desde el formulario del frontend (`http://localhost:3000/login`).*

---

## 🧪 Pruebas y Verificación

Para ejecutar la suite de pruebas del backend:

```bash
cd backend
./.venv/bin/pytest
```

---

## ⚙️ Variables de Entorno (Backend)

| Variable | Descripción | Valor por Defecto |
|---|---|---|
| `DATABASE_URL` | String de conexión SQLAlchemy a PostgreSQL | `postgresql+psycopg://postgres:postgres@localhost:5432/acredittia` |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT | `secret_dev_key` |
| `CORS_ORIGINS` | Orígenes permitidos para CORS | `http://localhost:3000` |

---

## ☁️ Despliegue en Azure

El proyecto está configurado para desplegarse en **Azure Container Apps** con los siguientes servicios:
- **API** y **Worker** en Container Apps (Consumo).
- Tareas programadas (cron) mediante Container App Jobs.
- **Base de Datos**: Azure Database for PostgreSQL Flexible Server.
- **Cache / Cola**: Redis auto-hospedado (Container App interno).
- **Almacenamiento y Secretos**: Azure Blob Storage y Azure Key Vault con identidades administradas (System-Assigned).

Los archivos de configuración de infraestructura como código (YAML) se encuentran en la raíz del proyecto. Para desplegar un componente, asegúrate de tener definido el archivo `.env` en la raíz (usando `backend/.env.azure.template` como referencia) y ejecuta:

```powershell
.\deploy.ps1 -YamlFile api.yaml
```

Para ver el detalle completo de la arquitectura y pasos de migración, revisa el documento `plan_migracion_azure.md`.


#!/bin/bash
# Script para iniciar Backend y Frontend de Acredittia con un solo comando

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Iniciando Acredittia..."

# Iniciar Backend
cd "$PROJECT_ROOT/backend"
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8001 &
BACKEND_PID=$!
echo "✅ Backend iniciado en http://127.0.0.1:8001 (PID: $BACKEND_PID)"

# Iniciar Frontend
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend iniciado en http://localhost:3000 (PID: $FRONTEND_PID)"

echo ""
echo "🌟 Plataforma lista:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://127.0.0.1:8001"
echo "   - Documentación: http://127.0.0.1:8001/docs"
echo ""
echo "💡 Presiona CTRL+C en esta terminal para detener ambos servidores."

# Manejo de cierre limpio al presionar CTRL+C
trap "echo -e '\n🛑 Deteniendo servidores...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM EXIT
wait

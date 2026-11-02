$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $RepoRoot

Write-Host "Iniciando sesión en ACR localmente..."
az acr login --name acredittiaregistry
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el login a ACR"; exit $LASTEXITCODE }

Write-Host "Iniciando build local de Docker..."
docker build -t acredittiaregistry.azurecr.io/acredittia-backend:latest -t acredittiaregistry.azurecr.io/acredittia-backend:v18 ./backend
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el build de Docker"; exit $LASTEXITCODE }

Write-Host "Subiendo imagen a Azure Container Registry..."
docker push acredittiaregistry.azurecr.io/acredittia-backend:latest
docker push acredittiaregistry.azurecr.io/acredittia-backend:v18
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el push de Docker a ACR"; exit $LASTEXITCODE }

Write-Host "Actualizando imagen del Job de migración..."
az containerapp job update --resource-group rg-acredittia --name acredittia-migrate --image acredittiaregistry.azurecr.io/acredittia-backend:v18

Write-Host "Iniciando Job de migración de base de datos..."
az containerapp job start --resource-group rg-acredittia --name acredittia-migrate
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el inicio del Job de migración"; exit $LASTEXITCODE }

Write-Host "Esperando 30 segundos a que finalice la migración..."
Start-Sleep -Seconds 30

Write-Host "Actualizando Container App: API..."
az containerapp update --resource-group rg-acredittia --name acredittia-api --image acredittiaregistry.azurecr.io/acredittia-backend:v18 --set-env-vars SCHEMA_VERSION_ESPERADA=18
if ($LASTEXITCODE -ne 0) { Write-Error "Falló la actualización de la API"; exit $LASTEXITCODE }

Write-Host "Actualizando Container App: Worker..."
az containerapp update --resource-group rg-acredittia --name acredittia-worker --image acredittiaregistry.azurecr.io/acredittia-backend:v18
if ($LASTEXITCODE -ne 0) { Write-Error "Falló la actualización del Worker"; exit $LASTEXITCODE }

Write-Host "Actualizando Jobs: Crons..."
az containerapp job update --resource-group rg-acredittia --name acredittia-cron-diario --image acredittiaregistry.azurecr.io/acredittia-backend:v18
az containerapp job update --resource-group rg-acredittia --name acredittia-cron-reportes --image acredittiaregistry.azurecr.io/acredittia-backend:v18
az containerapp job update --resource-group rg-acredittia --name acredittia-cron-purga --image acredittiaregistry.azurecr.io/acredittia-backend:v18

Write-Host "¡Despliegue completo a Azure finalizado con éxito!"

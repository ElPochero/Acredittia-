param(
    [ValidateSet("", "azure", "aws", "gcp", "compose")]
    [string]$Provider = "",
    [string]$ImageTag = "v20"
)

$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $RepoRoot

if (-not $Provider) {
    $Provider = if ($env:CLOUD_PROVIDER -and $env:CLOUD_PROVIDER -ne "local" -and $env:CLOUD_PROVIDER -ne "custom") {
        $env:CLOUD_PROVIDER
    } else {
        "azure"
    }
}

switch ($Provider) {
    "azure" {
        $Registry = if ($env:ACR_LOGIN_SERVER) { $env:ACR_LOGIN_SERVER } else { "acredittiaregistry.azurecr.io" }
        $AcrName = $Registry.Split('.')[0]
        $Rg = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { "rg-acredittia" }

        Write-Host "Iniciando sesión en ACR ($AcrName)..."
        az acr login --name $AcrName
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        docker build -t "${Registry}/acredittia-backend:latest" -t "${Registry}/acredittia-backend:${ImageTag}" ./backend
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        docker push "${Registry}/acredittia-backend:latest"
        docker push "${Registry}/acredittia-backend:${ImageTag}"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        az containerapp job update --resource-group $Rg --name acredittia-migrate --image "${Registry}/acredittia-backend:${ImageTag}"
        az containerapp job start --resource-group $Rg --name acredittia-migrate
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        Start-Sleep -Seconds 30
        az containerapp update --resource-group $Rg --name acredittia-api --image "${Registry}/acredittia-backend:${ImageTag}" --set-env-vars SCHEMA_VERSION_ESPERADA=20
        az containerapp update --resource-group $Rg --name acredittia-worker --image "${Registry}/acredittia-backend:${ImageTag}"
        az containerapp job update --resource-group $Rg --name acredittia-cron-diario --image "${Registry}/acredittia-backend:${ImageTag}"
        az containerapp job update --resource-group $Rg --name acredittia-cron-reportes --image "${Registry}/acredittia-backend:${ImageTag}"
        az containerapp job update --resource-group $Rg --name acredittia-cron-purga --image "${Registry}/acredittia-backend:${ImageTag}"
    }
    "aws" {
        $Region = if ($env:AWS_REGION) { $env:AWS_REGION } else { "us-east-1" }
        $Registry = $env:AWS_ECR_REGISTRY
        $Cluster = if ($env:AWS_ECS_CLUSTER) { $env:AWS_ECS_CLUSTER } else { "acredittia-cluster" }
        if (-not $Registry) { Write-Error "Define AWS_ECR_REGISTRY para desplegar en AWS"; exit 1 }

        aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $Registry
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        docker build -t "${Registry}/acredittia-backend:${ImageTag}" ./backend
        docker push "${Registry}/acredittia-backend:${ImageTag}"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        aws ecs run-task --cluster $Cluster --launch-type FARGATE --task-definition acredittia-migrate
        aws ecs update-service --cluster $Cluster --service acredittia-api --force-new-deployment
        aws ecs update-service --cluster $Cluster --service acredittia-worker --force-new-deployment
    }
    "gcp" {
        $Region = if ($env:GCP_REGION) { $env:GCP_REGION } else { "us-central1" }
        $Image = $env:GCP_IMAGE
        if (-not $Image) { Write-Error "Define GCP_IMAGE (Artifact Registry URI) para desplegar en GCP"; exit 1 }

        docker build -t $Image ./backend
        docker push $Image
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        gcloud run jobs execute acredittia-migrate --region $Region --wait
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

        gcloud run services update acredittia-api --image $Image --region $Region
        gcloud run services update acredittia-worker --image $Image --region $Region
    }
    "compose" {
        docker compose -f infra/compose-prod/docker-compose.prod.yml up -d --build
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Write-Host "¡Despliegue ($Provider) finalizado con éxito!"

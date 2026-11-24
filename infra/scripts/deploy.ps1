param(
    [Parameter(Mandatory=$true)]
    [string]$YamlFile,
    [ValidateSet("", "azure", "aws", "gcp", "compose")]
    [string]$Provider = ""
)

$RepoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
$EnvFile = Join-Path $RepoRoot ".env"

if (-not (Test-Path $EnvFile)) {
    Write-Error "No se encontró el archivo .env en $EnvFile. Asegúrate de que existe en la raíz del proyecto."
    exit 1
}

# Cargar .env en el entorno actual (ignorando comentarios)
Get-Content $EnvFile | Where-Object { $_ -match "^[A-Z0-9_]+=" } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value.Trim()
}

if (-not $Provider) {
    $Provider = if ($env:CLOUD_PROVIDER -and $env:CLOUD_PROVIDER -ne "local" -and $env:CLOUD_PROVIDER -ne "custom") {
        $env:CLOUD_PROVIDER
    } else {
        "azure"
    }
}

# Resolver ruta del manifiesto: acepta ruta completa, relativa o nombre dentro de infra/<Provider>/
if (-not (Test-Path $YamlFile)) {
    $candidates = @(
        (Join-Path $RepoRoot "infra\$Provider\$YamlFile"),
        (Join-Path $RepoRoot "infra\$Provider\$YamlFile.yaml"),
        (Join-Path $RepoRoot "infra\$Provider\$YamlFile.yml"),
        (Join-Path $RepoRoot "infra\$Provider\$YamlFile.json")
    )
    $resolved = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $resolved) {
        Write-Error "No se encontró el manifiesto para ${Provider}: $YamlFile"
        exit 1
    }
    $YamlFile = $resolved
}

Write-Host "[$Provider] Cargando $YamlFile y reemplazando variables..."
$content = Get-Content $YamlFile -Raw

$content = [System.Text.RegularExpressions.Regex]::Replace($content, '\$\{([^}]+)\}', {
    param($match)
    $varName = $match.Groups[1].Value
    if (Test-Path "Env:$varName") {
        return (Get-Item "Env:$varName").Value
    }
    Write-Warning "Variable $varName no encontrada en el .env!"
    return $match.Value
})

$tempFile = "$YamlFile.tmp"
[IO.File]::WriteAllText($tempFile, $content, [System.Text.Encoding]::UTF8)

$ResourceName = [System.IO.Path]::GetFileNameWithoutExtension($YamlFile)

try {
    switch ($Provider) {
        "azure" {
            Write-Host "Desplegando $ResourceName en Azure Container Apps..."
            if ($ResourceName -like "cron-*" -or $ResourceName -like "migrate*") {
                az containerapp job create --resource-group rg-acredittia --name $ResourceName --yaml $tempFile
            } else {
                az containerapp create --resource-group rg-acredittia --name $ResourceName --yaml $tempFile
            }
        }
        "aws" {
            Write-Host "Registrando definición ECS en AWS ($ResourceName)..."
            aws ecs register-task-definition --cli-input-json "file://$tempFile"
        }
        "gcp" {
            Write-Host "Desplegando $ResourceName en Google Cloud Run..."
            if ($ResourceName -like "*job*" -or $ResourceName -like "*cron*" -or $ResourceName -like "*migrate*") {
                gcloud run jobs replace $tempFile --region ($env:GCP_REGION ?? "us-central1")
            } else {
                gcloud run services replace $tempFile --region ($env:GCP_REGION ?? "us-central1")
            }
        }
        "compose" {
            Write-Host "Levantando stack productivo con Docker Compose..."
            docker compose -f $tempFile up -d --build
        }
    }
} finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

Write-Host "¡Despliegue ($Provider) finalizado!"

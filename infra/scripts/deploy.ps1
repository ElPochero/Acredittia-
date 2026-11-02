param(
    [Parameter(Mandatory=$true)]
    [string]$YamlFile
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

# Resolver ruta del archivo YAML: acepta ruta completa, relativa o nombre dentro de infra/azure/
if (-not (Test-Path $YamlFile)) {
    $candidate = Join-Path $RepoRoot "infra\azure\$YamlFile"
    if (Test-Path $candidate) {
        $YamlFile = $candidate
    } elseif (Test-Path "$candidate.yaml") {
        $YamlFile = "$candidate.yaml"
    } else {
        Write-Error "No se encontró el archivo YAML: $YamlFile"
        exit 1
    }
}

Write-Host "Cargando archivo $YamlFile y reemplazando variables..."
$content = Get-Content $YamlFile -Raw

# Reemplazar variables ${VAR_NAME} por sus valores reales del entorno
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

Write-Host "Desplegando $ResourceName en Azure Container Apps..."
if ($ResourceName -like "cron-*" -or $ResourceName -like "migrate*") {
    az containerapp job create --resource-group rg-acredittia --name $ResourceName --yaml $tempFile
} else {
    az containerapp create --resource-group rg-acredittia --name $ResourceName --yaml $tempFile
}

Remove-Item $tempFile -ErrorAction SilentlyContinue
Write-Host "¡Despliegue finalizado!"

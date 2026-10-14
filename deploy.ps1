param(
    [Parameter(Mandatory=$true)]
    [string]$YamlFile
)

if (-not (Test-Path ".env")) {
    Write-Error "No se encontró el archivo .env. Asegúrate de que existe en la raíz del proyecto."
    exit 1
}

# Cargar .env en el entorno actual (ignorando comentarios)
Get-Content .env | Where-Object { $_ -match "^[A-Z0-9_]+=" } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    Set-Item -Path "Env:$name" -Value $value.Trim()
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

Write-Host "Desplegando en Azure Container Apps..."
if ($YamlFile -like "cron-*" -or $YamlFile -like "migrate*") {
    az containerapp job create --resource-group rg-acredittia --name ($YamlFile.Replace(".yaml","")) --yaml $tempFile
} else {
    az containerapp create --resource-group rg-acredittia --name ($YamlFile.Replace(".yaml","")) --yaml $tempFile
}

Remove-Item $tempFile -ErrorAction SilentlyContinue
Write-Host "¡Despliegue finalizado!"

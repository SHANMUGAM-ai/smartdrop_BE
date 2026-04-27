# MongoDB Local Dev Startup Script
# Bypasses Windows Service — uses project-local data directory

$DbPath = "d:/smartdrop/smartdrop/backend/mongodb-data"
$LogPath = "d:/smartdrop/smartdrop/backend/mongodb-data/mongod.log"
$MongoBin = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe"

# Create data directory if it doesn't exist
if (-not (Test-Path $DbPath)) {
    New-Item -ItemType Directory -Path $DbPath | Out-Null
    Write-Host "Created data directory: $DbPath"
}

# Verify mongod.exe exists
if (-not (Test-Path $MongoBin)) {
    Write-Error "mongod.exe not found at $MongoBin"
    Write-Host "Please check your MongoDB installation path."
    exit 1
}

Write-Host "Starting MongoDB on port 27017..."
Write-Host "Data directory: $DbPath"
Write-Host "Log file: $LogPath"
Write-Host ""
Write-Host "Press Ctrl+C to stop MongoDB"

& $MongoBin --dbpath $DbPath --logpath $LogPath --port 27017 --bind_ip 127.0.0.1


$nodePath = "C:\Program Files\nodejs"
$currentPath = [System.Environment]::GetEnvironmentVariable("PATH", "Machine")
if ($currentPath -notlike "*nodejs*") {
    [System.Environment]::SetEnvironmentVariable("PATH", $currentPath + ";" + $nodePath, "Machine")
    Write-Host "Added nodejs to system PATH"
} else {
    Write-Host "nodejs already in PATH"
}
Write-Host "Current session: setting PATH now..."
$env:PATH = $env:PATH + ";" + $nodePath
& node --version
& npm --version

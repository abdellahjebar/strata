$env:PATH = $env:PATH + ";C:\Program Files\nodejs"
Set-Location "c:\perso\Projects\Strata\frontend"
& "C:\Program Files\nodejs\npm.cmd" create vite@latest . -- --template react

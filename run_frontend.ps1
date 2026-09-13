$env:PATH = $env:PATH + ";C:\Program Files\nodejs"
Set-Location "C:\perso\Projects\Strata\frontend"
& "C:\Program Files\nodejs\npm.cmd" run dev -- --host

$env:PATH = $env:PATH + ";C:\Program Files\nodejs"
Set-Location "c:\perso\Projects\Strata\frontend"
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" install react-markdown remark-gfm

$ErrorActionPreference = 'SilentlyContinue'

$rootDirSizes = @{}
$userDirSizes = @{}
$largeFiles = @()

foreach ($file in Get-ChildItem C:\ -File -Recurse -Force) {
    try {
        $len = $file.Length
        
        if ($len -gt 500MB) {
            $largeFiles += [PSCustomObject]@{ File = $file.FullName; SizeGB = [math]::Round($len / 1GB, 2) }
        }

        $pathParts = $file.FullName.Split('\')
        if ($pathParts.Count -ge 2) {
            $rFolder = "C:\" + $pathParts[1]
            $rootDirSizes[$rFolder] += $len
        }
        
        if ($pathParts.Count -ge 4 -and $pathParts[1] -eq 'Users' -and $pathParts[2] -eq 'Abdellah') {
            $uFolder = "C:\Users\Abdellah\" + $pathParts[3]
            $userDirSizes[$uFolder] += $len
        }
    } catch {}
}

$report = "=== Top Root Folders ===`n"
$out1 = @()
foreach ($k in $rootDirSizes.Keys) {
    if ($rootDirSizes[$k] -ge 1GB) { $out1 += [PSCustomObject]@{ Folder=$k; SizeGB=[math]::Round($rootDirSizes[$k]/1GB, 2)} }
}
$report += ($out1 | Sort-Object SizeGB -Descending | Format-Table -AutoSize | Out-String)

$report += "`n=== Top Folders in C:\Users\Abdellah ===`n"
$out2 = @()
foreach ($k in $userDirSizes.Keys) {
    if ($userDirSizes[$k] -ge 1GB) { $out2 += [PSCustomObject]@{ Folder=$k; SizeGB=[math]::Round($userDirSizes[$k]/1GB, 2)} }
}
$report += ($out2 | Sort-Object SizeGB -Descending | Format-Table -AutoSize | Out-String)

$report += "`n=== Largest Files (>500MB) ===`n"
$report += ($largeFiles | Sort-Object SizeGB -Descending | Select-Object -First 25 | Format-Table -AutoSize | Out-String)

$report | Out-File "C:\perso\Projects\Strata\DiskAnalysisReport.txt" -Encoding UTF8
Write-Output "ANALYSIS_DONE"

param([string]$ManifestName='sources.json',[string]$SheetName='contact_sheet.png')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = Join-Path $PSScriptRoot 'waneella_assets'
$sources = Get-Content -LiteralPath (Join-Path $assetDir $ManifestName) -Raw | ConvertFrom-Json
$sheet = New-Object System.Drawing.Bitmap(1440, 900)
$graphics = [System.Drawing.Graphics]::FromImage($sheet)
$graphics.Clear([System.Drawing.Color]::FromArgb(24,29,38))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$font = New-Object System.Drawing.Font('Arial',16)
$index=0
foreach ($art in $sources) {
    $gif = Join-Path $assetDir ($art.id + '.gif')
    if (-not (Test-Path -LiteralPath $gif)) { Invoke-WebRequest $art.image -OutFile $gif }
    $im = [System.Drawing.Image]::FromFile($gif)
    $im.Save((Join-Path $assetDir ($art.id + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
    $ratio = [Math]::Min(330.0 / $im.Width, 385.0 / $im.Height)
    $w = [int]($im.Width * $ratio); $h = [int]($im.Height * $ratio)
    $x = ($index % 4)*360 + [int]((360-$w)/2); $y=[int][Math]::Floor($index/4)*450+35
    $graphics.DrawImage($im,$x,$y,$w,$h)
    $graphics.DrawString($art.title,$font,[System.Drawing.Brushes]::White,[single](($index % 4)*360+15),[single]($y-30))
    Write-Output ($art.title + ': ' + $im.Width + 'x' + $im.Height)
    $im.Dispose(); $index++
}
$sheet.Save((Join-Path $assetDir $SheetName),[System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose(); $graphics.Dispose(); $sheet.Dispose()

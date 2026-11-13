$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetDir=Join-Path $PSScriptRoot '../public/assets'
$manifestPath=Join-Path $assetDir 'collection-artworks.json'
$works=Get-Content -LiteralPath $manifestPath -Raw -Encoding utf8 | ConvertFrom-Json
$sheet=New-Object System.Drawing.Bitmap(1200,800)
$graphics=[System.Drawing.Graphics]::FromImage($sheet)
$graphics.Clear([System.Drawing.Color]::FromArgb(25,30,30))
$font=New-Object System.Drawing.Font('Arial',12)
$i=0
foreach($art in $works){
  $tempPath=Join-Path $env:TEMP ('waneella-'+$art.id+'.gif')
  Invoke-WebRequest -Uri $art.image -OutFile $tempPath -UseBasicParsing
  $im=[System.Drawing.Image]::FromFile($tempPath)
  $jpgPath=Join-Path $assetDir ($art.id+'.jpg')
  $im.Save($jpgPath,[System.Drawing.Imaging.ImageFormat]::Jpeg)
  $art | Add-Member -NotePropertyName thumbnail -NotePropertyValue ('assets/'+$art.id+'.jpg') -Force
  $art | Add-Member -NotePropertyName pixels -NotePropertyValue @($im.Width,$im.Height) -Force
  $art | Add-Member -NotePropertyName artist -NotePropertyValue 'Waneella' -Force
  $ratio=[Math]::Min(280.0/$im.Width,350.0/$im.Height)
  $x=($i%4)*300; $y=[Math]::Floor($i/4)*400
  $graphics.DrawImage($im,[int]$x,[int]($y+30),[int]($im.Width*$ratio),[int]($im.Height*$ratio))
  $graphics.DrawString($art.title,$font,[System.Drawing.Brushes]::White,[single]$x,[single]$y)
  $im.Dispose(); $i++
}
$works | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath -Encoding utf8
$sheet.Save((Join-Path $PSScriptRoot '../gallery_output/collection-additions-contact.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $sheet.Dispose(); $font.Dispose()

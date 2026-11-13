param([string]$PythonPath='D:/Bleder/5.2/python/bin/python.exe')
$ErrorActionPreference='Stop'
$previewTools=Join-Path $env:TEMP 'RVAAnimatedCollection/tools'
if (-not (Test-Path -LiteralPath (Join-Path $previewTools 'imageio_ffmpeg/binaries'))) {
  & $PythonPath -m pip install --target $previewTools imageio-ffmpeg Pillow
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the temporary video tools.' }
}
& $PythonPath (Join-Path $PSScriptRoot 'prepare-collection-previews.py')
if ($LASTEXITCODE -ne 0) { throw 'Collection preview generation failed.' }

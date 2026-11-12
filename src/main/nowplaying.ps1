# Lit le morceau en cours depuis Windows, sans compte ni cle. Une ligne JSON par seconde sur la sortie.
# Commandes sur l'entree : play, pause, next, previous. L'entree fermee arrete le script.
param([string]$Mode = 'spotify')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($operation, $type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($operation))
  $null = $task.Wait(-1)
  return $task.Result
}

$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$manager = Await ($managerType::RequestAsync()) $managerType

function Get-Session {
  $spotify = @($manager.GetSessions()) | Where-Object { $_.SourceAppUserModelId -match 'spotify' } | Select-Object -First 1
  if ($spotify) { return $spotify }
  if ($Mode -eq 'any') { return $manager.GetCurrentSession() }
  return $null
}

function Read-Cover($reference) {
  if (-not $reference) { return '' }
  try {
    $stream = Await ($reference.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
    $memory = New-Object System.IO.MemoryStream
    $net.CopyTo($memory)
    $net.Dispose()
    $stream.Dispose()
    return 'data:image/png;base64,' + [Convert]::ToBase64String($memory.ToArray())
  } catch { return '' }
}

# Les flux bruts evitent l'encodage de la console et ne bloquent pas la boucle.
$stdout = New-Object System.IO.StreamWriter([Console]::OpenStandardOutput(), (New-Object System.Text.UTF8Encoding $false))
$stdout.AutoFlush = $true
$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput())

function Write-Line($value) {
  $stdout.WriteLine(($value | ConvertTo-Json -Compress -Depth 3))
}

$pending = $reader.ReadLineAsync()
$lastKey = ''
$lastCover = ''
$coverChecks = 0

while ($true) {
  if ($pending.IsCompleted) {
    $command = $pending.Result
    if ($null -eq $command) { exit 0 }
    $pending = $reader.ReadLineAsync()
    $session = Get-Session
    if ($session) {
      switch ($command) {
        'play' { $null = Await ($session.TryPlayAsync()) ([bool]) }
        'pause' { $null = Await ($session.TryPauseAsync()) ([bool]) }
        'next' { $null = Await ($session.TrySkipNextAsync()) ([bool]) }
        'previous' { $null = Await ($session.TrySkipPreviousAsync()) ([bool]) }
      }
    }
  }
  try {
    $session = Get-Session
    if (-not $session) {
      $lastKey = ''
      Write-Line @{ none = $true }
    } else {
      $properties = Await ($session.TryGetMediaPropertiesAsync()) $propertiesType
      $playback = $session.GetPlaybackInfo()
      $timeline = $session.GetTimelineProperties()
      $key = "$($properties.Title)|$($properties.Artist)"
      $line = [ordered]@{
        title = $properties.Title
        artist = $properties.Artist
        album = $properties.AlbumTitle
        playing = ($playback.PlaybackStatus.ToString() -eq 'Playing')
        position = [long]$timeline.Position.TotalMilliseconds
        duration = [long]$timeline.EndTime.TotalMilliseconds
        updated = [long]$timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
      }
      if ($key -ne $lastKey) {
        $lastKey = $key
        $lastCover = ''
        $coverChecks = 4
        $line.cover = ''
      }
      # Windows donne souvent le titre avant la pochette : on la relit quelques secondes.
      if ($coverChecks -gt 0) {
        $coverChecks -= 1
        $cover = Read-Cover $properties.Thumbnail
        if ($cover -and $cover -ne $lastCover) {
          $lastCover = $cover
          $line.cover = $cover
        }
      }
      Write-Line $line
    }
  } catch {
    Write-Line @{ error = $_.Exception.Message }
  }
  Start-Sleep -Milliseconds 1000
}

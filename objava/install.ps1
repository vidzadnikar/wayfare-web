# Wayfare Studio: install on Windows with one command (PowerShell).
#
#   irm https://wayfarestudio.pages.dev/install.ps1 | iex
#
# What it does: downloads the Wayfare Studio 0.2.0 installer for 64-bit
# Windows from the project's GitHub release, checks its SHA-256 checksum,
# installs it for the current user (no administrator rights) and opens it.
# The installer runs without questions; its licence is in the install folder
# (LICENSES).
#
# Why no SmartScreen warning: the installer is not signed yet. A file
# downloaded in a browser gets a "downloaded from the internet" mark, so
# SmartScreen stops it. A file downloaded by PowerShell has no such mark.
# You are trusting this script and the GitHub release it names, so read it
# first if you like: https://wayfarestudio.pages.dev/install.ps1
#
# Source: https://github.com/vidzadnikar/wayfare-web (stran/install.ps1)
#
# Everything runs inside one block, after the whole script has arrived, and
# never calls exit: with "irm | iex" exit would close your PowerShell window.

& {
  $ErrorActionPreference = 'Stop'
  # Brez tega je prenos v PowerShell 5.1 zelo pocasen (risanje napredka).
  $ProgressPreference = 'SilentlyContinue'

  $Razlicica = '0.2.0'
  $Url = 'https://github.com/vidzadnikar/wayfare-web/releases/download/v0.2.0/Wayfare-Studio-Setup-0.2.0.exe'
  $Sha256 = 'a7e770a3486e1a9efebd3a0ba838b5714fb621f940980f800633bf6a16babdc3'
  $Velikost = '317 MB'
  $Stran = 'https://wayfarestudio.pages.dev'
  $AppId = '{7C1E3D8A-6B2F-4C7E-9E1B-2D5F8A3C4B61}_is1'

  # Imena spremenljivk v PowerShellu ne locijo velikih in malih crk: parameter
  # $sl bi skril zastavico $Sl, zato imata razlicni imeni.
  $Slovensko = (Get-UICulture).Name -like 'sl*'
  function Povej([string]$angl, [string]$slov, [string]$barva = 'Gray') {
    if ($Slovensko) { Write-Host $slov -ForegroundColor $barva } else { Write-Host $angl -ForegroundColor $barva }
  }

  if ([Environment]::OSVersion.Version.Major -lt 10 -or -not [Environment]::Is64BitOperatingSystem) {
    Povej "Wayfare Studio needs 64-bit Windows 10 or newer." `
          "Wayfare Studio potrebuje 64-bitni Windows 10 ali novejši." 'Red'
    return
  }
  if (Get-Process -Name 'Wayfare Studio' -ErrorAction SilentlyContinue) {
    Povej "Wayfare Studio is open. Quit it (its icon in the taskbar tray) and run the command again." `
          "Wayfare Studio je odprt. Zapri ga (ikona v opravilni vrstici) in ukaz zaženi znova." 'Red'
    return
  }

  # Starejsi Windows 10 ima v PowerShell 5.1 privzeto se TLS 1.0.
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $mapa = Join-Path ([IO.Path]::GetTempPath()) ('wayfare-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $mapa | Out-Null
  $namestitev = Join-Path $mapa "Wayfare-Studio-Setup-$Razlicica.exe"
  try {
    Povej "Downloading Wayfare Studio $Razlicica ($Velikost) ..." `
          "Prenašam Wayfare Studio $Razlicica ($Velikost) ..."
    Invoke-WebRequest -Uri $Url -OutFile $namestitev -UseBasicParsing

    $vsota = (Get-FileHash -Path $namestitev -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($vsota -ne $Sha256) {
      Povej "The download does not match the published checksum. Nothing was installed. Try again later." `
            "Prenos se ne ujema z objavljeno kontrolno vsoto. Nič ni nameščeno. Poskusi znova kasneje." 'Red'
      return
    }

    Povej "Installing for your user ..." "Nameščam za tvojega uporabnika ..."
    $jezik = if ($Slovensko) { 'slovenian' } else { 'english' }
    $proces = Start-Process -FilePath $namestitev -Wait -PassThru -ArgumentList @(
      '/SILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-', '/CURRENTUSER', "/LANG=$jezik")
    if ($proces.ExitCode -ne 0) {
      Povej "The installer stopped (code $($proces.ExitCode)). Download it from $Stran and run it by hand." `
            "Namestitveni program se je ustavil (koda $($proces.ExitCode)). Prenesi ga s $Stran in ga zaženi sam." 'Red'
      return
    }

    # Kam je namestil: zapis za odstranitev, sicer privzeta mapa za uporabnika.
    $kljuc = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$AppId"
    $mesto = (Get-ItemProperty -Path $kljuc -ErrorAction SilentlyContinue).InstallLocation
    if (-not $mesto) { $mesto = Join-Path $env:LOCALAPPDATA 'Programs\Wayfare Studio' }
    $program = Join-Path $mesto 'Wayfare Studio.exe'

    Povej "Done. Wayfare Studio $Razlicica is installed. Opening it ..." `
          "Končano. Wayfare Studio $Razlicica je nameščen. Odpiram ga ..." 'Green'
    if (Test-Path $program) { Start-Process -FilePath $program }
  }
  catch {
    Povej "Installation failed: $($_.Exception.Message)" "Namestitev ni uspela: $($_.Exception.Message)" 'Red'
  }
  finally {
    Remove-Item -Path $mapa -Recurse -Force -ErrorAction SilentlyContinue
  }
}

#!/bin/bash
# Wayfare Studio: install on a Mac with one command.
#
#   curl -fsSL https://wayfarestudio.pages.dev/install.sh | bash
#
# What it does: downloads Wayfare Studio __RAZLICICA__ for Macs with Apple
# silicon from the project's GitHub release, checks its SHA-256 checksum,
# copies the app into Applications and opens it.
#
# Why no warning: the app is not notarized by Apple yet. A file downloaded in
# a browser gets a "downloaded from the internet" mark, so macOS stops the
# app the first time. A file downloaded by curl in Terminal has no such mark.
# You are trusting this script and the GitHub release it names, so read it
# first if you like: https://wayfarestudio.pages.dev/install.sh
#
# Source: https://github.com/vidzadnikar/wayfare-web (stran/install.sh)

set -euo pipefail

RAZLICICA="__RAZLICICA__"
URL="__URL__"
SHA256="__SHA256__"
VELIKOST="__VELIKOST__"
APP="Wayfare Studio.app"
STRAN="https://wayfarestudio.pages.dev"

# Everything runs from main, after the whole script has arrived: a download
# cut off halfway does nothing.
main() {
  local jezik
  jezik=$(defaults read -g AppleLanguages 2>/dev/null | tr -d ' \n()"' | cut -d, -f1 || true)
  if [[ "$jezik" == sl* ]]; then SL=1; else SL=0; fi

  [[ "$(uname -s)" == "Darwin" ]] || napaka \
    "This command is for a Mac. For Windows and Android, download Wayfare Studio from $STRAN" \
    "Ta ukaz je za Mac. Za Windows in Android prenesi Wayfare Studio s $STRAN"
  [[ "$(uname -m)" == "arm64" ]] || napaka \
    "Wayfare Studio needs a Mac with Apple silicon (M1 or newer)." \
    "Wayfare Studio potrebuje Mac z Apple silicon (M1 ali novejši)."
  local glavna
  glavna=$(sw_vers -productVersion | cut -d. -f1)
  (( glavna >= 12 )) || napaka \
    "Wayfare Studio needs macOS 12 or newer." \
    "Wayfare Studio potrebuje macOS 12 ali novejši."

  local cilj="/Applications"
  if [[ ! -w "$cilj" ]]; then
    cilj="$HOME/Applications"
    mkdir -p "$cilj"
  fi
  if pgrep -f "$APP/Contents/MacOS/" >/dev/null 2>&1; then
    napaka "Wayfare Studio is open. Quit it (Cmd+Q) and run the command again." \
           "Wayfare Studio je odprt. Zapri ga (Cmd+Q) in ukaz zaženi znova."
  fi

  ZACASNO=$(mktemp -d)
  trap pospravi EXIT
  local dmg="$ZACASNO/Wayfare-Studio.dmg" priklop="$ZACASNO/priklop"

  povej "Downloading Wayfare Studio $RAZLICICA ($VELIKOST) ..." \
        "Prenašam Wayfare Studio $RAZLICICA ($VELIKOST) ..."
  curl -fL --progress-bar -o "$dmg" "$URL"

  local vsota
  vsota=$(shasum -a 256 "$dmg" | cut -d' ' -f1)
  [[ "$vsota" == "$SHA256" ]] || napaka \
    "The download does not match the published checksum. Nothing was installed. Try again later." \
    "Prenos se ne ujema z objavljeno kontrolno vsoto. Nič ni nameščeno. Poskusi znova kasneje."

  mkdir "$priklop"
  hdiutil attach -quiet -nobrowse -readonly -mountpoint "$priklop" "$dmg"
  PRIKLOP="$priklop"
  [[ -d "$priklop/$APP" ]] || napaka "The download has no $APP." "V prenosu ni $APP."

  povej "Installing into $cilj ..." "Nameščam v $cilj ..."
  # Nova kopija ob stari, nato zamenjava: prekinjena namestitev ne pusti
  # napol skopirane aplikacije.
  rm -rf "$cilj/.$APP.nova"
  ditto "$priklop/$APP" "$cilj/.$APP.nova"
  rm -rf "$cilj/$APP"
  mv "$cilj/.$APP.nova" "$cilj/$APP"

  povej "Done. Wayfare Studio $RAZLICICA is in $cilj. Opening it ..." \
        "Končano. Wayfare Studio $RAZLICICA je v $cilj. Odpiram ga ..."
  open "$cilj/$APP" || true
}

povej() { if [[ "${SL:-0}" == 1 ]]; then echo "$2"; else echo "$1"; fi; }
napaka() { povej "$1" "$2" >&2; exit 1; }
pospravi() {
  if [[ -n "${PRIKLOP:-}" ]]; then hdiutil detach -quiet "$PRIKLOP" 2>/dev/null || true; fi
  if [[ -n "${ZACASNO:-}" ]]; then rm -rf "$ZACASNO"; fi
}

main "$@"

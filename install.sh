#!/bin/sh
# Install a verified Brewman release into ~/Applications. No sudo or nsh required.
#   curl -fsSL https://huacnlee.github.io/brewman/install.sh | sh
#   curl -fsSL https://huacnlee.github.io/brewman/install.sh | sh -s -- --version v0.1.0
set -eu
repo=huacnlee/brewman
bundle_id=app.brewman.desktop
version=${BREWMAN_VERSION:-latest}
apps=${BREWMAN_APPS_DIR:-$HOME/Applications}
usage() {
  printf '%s\n' 'Usage: install.sh [--version VERSION] [--dir DIRECTORY]' \
    'Defaults: the latest release, installed to ~/Applications/Brewman.app.'
}
while [ "$#" -gt 0 ]; do
  case $1 in
    --version|--dir)
      [ "$#" -ge 2 ] || { usage >&2; exit 2; }
      if [ "$1" = --version ]; then version=$2; else apps=$2; fi
      shift 2;;
    -h|--help) usage; exit 0;;
    -*) usage >&2; exit 2;;
    *) [ -z "$1" ] || version=$1; shift;;
  esac
done
[ "$(uname -s)" = Darwin ] || { echo 'Brewman runs on macOS only' >&2; exit 1; }
case $(uname -m) in arm64) arch=aarch64;; x86_64) arch=x86_64;; *) echo 'Unsupported CPU architecture' >&2; exit 1;; esac
# A shell under Rosetta reports x86_64; prefer the native build on Apple silicon.
[ "$arch" = x86_64 ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ] && arch=aarch64

fetch() { curl --proto '=https' --tlsv1.2 -fsSL --retry 3 "$@"; }
if [ "$version" = latest ]; then
  location=$(fetch -o /dev/null -w '%{url_effective}' "https://github.com/$repo/releases/latest")
  version=${location##*/}
fi
case $version in v[0-9]*) ;; [0-9]*) version=v$version;; *) echo 'Expected a release version such as v0.1.0' >&2; exit 1;; esac
case $version in *[!a-zA-Z0-9._-]*) echo 'Invalid version' >&2; exit 1;; esac

archive=brewman-$version-$arch-apple-darwin.tar.gz
base=https://github.com/$repo/releases/download/$version
scratch=$(mktemp -d)
staging=
retired=
cleanup() {
  status=$?
  trap - EXIT HUP INT TERM
  [ -z "$staging" ] || rm -rf -- "$staging"
  [ -z "$retired" ] || rm -rf -- "$retired"
  rm -rf -- "$scratch"
  exit "$status"
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

printf 'Downloading Brewman %s for %s...\n' "$version" "$arch"
status=0
fetch "$base/$archive" -o "$scratch/$archive" || status=$?
if [ "$status" -eq 22 ]; then
  printf 'Brewman %s has no %s build. See https://github.com/%s/releases\n' "$version" "$arch" "$repo" >&2
  exit 1
fi
[ "$status" -eq 0 ] || exit "$status"
fetch "$base/SHA256SUMS" -o "$scratch/SHA256SUMS"
expected=$(awk -v file="$archive" '$2 == file {print $1}' "$scratch/SHA256SUMS")
[ "${#expected}" -eq 64 ] || { echo 'Release checksum is missing' >&2; exit 1; }
actual=$(shasum -a 256 "$scratch/$archive" | awk '{print $1}')
[ "$expected" = "$actual" ] || { echo 'Checksum verification failed' >&2; exit 1; }

mkdir -p "$apps"
apps=$(CDPATH= cd -- "$apps" && pwd -P)
target=$apps/Brewman.app
# Replace an existing Brewman.app only when it is this app.
if [ -e "$target" ] || [ -L "$target" ]; then
  if [ -L "$target" ] || [ "$(defaults read "$target/Contents/Info" CFBundleIdentifier 2>/dev/null || :)" != "$bundle_id" ]; then
    printf '%s is not a Brewman installation; refusing to replace it\n' "$target" >&2
    exit 1
  fi
fi
# Unpack beside the destination so activation is a rename on one filesystem.
staging=$(mktemp -d "$apps/.brewman-staging.XXXXXX")
tar -xzf "$scratch/$archive" -C "$staging"
[ -x "$staging/Brewman.app/Contents/MacOS/Brewman" ] || { echo 'Release has no Brewman.app' >&2; exit 1; }
if [ -d "$target" ]; then
  osascript -e "tell application id \"$bundle_id\" to quit" >/dev/null 2>&1 || :
  retired=$(mktemp -d "$apps/.brewman-retired.XXXXXX")
  mv -- "$target" "$retired/"
  if ! mv -- "$staging/Brewman.app" "$target"; then
    mv -- "$retired/Brewman.app" "$target"
    echo 'Could not activate the new release' >&2
    exit 1
  fi
else
  mv -- "$staging/Brewman.app" "$target"
fi
lsregister=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
[ ! -x "$lsregister" ] || "$lsregister" -f "$target" >/dev/null 2>&1 || :
printf 'Installed Brewman %s to %s\nOpen it with: open "%s"\n' "$version" "$target" "$target"

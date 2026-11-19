#!/bin/sh
# Package Brewman.app for this Mac's architecture into .nsh/dist:
#   brewman-vVERSION-ARCH-apple-darwin.tar.gz  (Brewman.app, LICENSE)
# Usage: scripts/build-release.sh 0.1.0
set -eu
version=${1:?Usage: scripts/build-release.sh VERSION}
version=${version#v}
case $version in [0-9]*.[0-9]*.[0-9]*) ;; *) echo "Expected a version such as 0.1.0" >&2; exit 2;; esac
[ "$(uname -s)" = Darwin ] || { echo "Build on macOS" >&2; exit 1; }
case $(uname -m) in arm64) arch=aarch64;; x86_64) arch=x86_64;; *) echo "Unsupported CPU" >&2; exit 1;; esac

root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
stage=.nsh/package/brewman-v$version-$arch-apple-darwin
dist=.nsh/dist
rm -rf "$stage"
mkdir -p "$stage" "$dist"

nsh package --target macos --app-version "$version" -o "$stage" .
[ -x "$stage/Brewman.app/Contents/MacOS/Brewman" ] || { echo "Packaging produced no Brewman.app" >&2; exit 1; }
cp LICENSE "$stage/LICENSE"

archive=$dist/brewman-v$version-$arch-apple-darwin.tar.gz
tar -czf "$archive" -C "$stage" Brewman.app LICENSE
printf 'Built %s\nSHA256 %s\n' "$archive" "$(shasum -a 256 "$archive" | awk '{print $1}')"

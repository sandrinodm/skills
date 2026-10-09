#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: pull-package-apks <package.id> <output-dir>" >&2
  exit 2
fi

PACKAGE_ID="$1"
OUT_DIR="$2"

mkdir -p "$OUT_DIR"

adb shell pm path "$PACKAGE_ID" \
  | tr -d '\r' \
  | sed 's/^package://' \
  | while IFS= read -r apk_path; do
    if [[ -n "$apk_path" ]]; then
      adb pull "$apk_path" "$OUT_DIR/$(basename "$apk_path")"
    fi
  done

adb shell dumpsys package "$PACKAGE_ID" > "$OUT_DIR/package-dumpsys.txt"
sha256sum "$OUT_DIR"/*.apk > "$OUT_DIR/SHA256SUMS"

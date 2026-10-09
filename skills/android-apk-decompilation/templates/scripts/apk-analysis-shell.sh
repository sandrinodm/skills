#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${APK_TOOLS_IMAGE:-apk-tools:local}"
PLATFORM="${APK_TOOLS_PLATFORM:-linux/amd64}"
APP_SLUG="${APK_APP_SLUG:-android-app}"

mkdir -p \
  "$ROOT/artifacts/apk/$APP_SLUG/play" \
  "$ROOT/artifacts/apk/$APP_SLUG/mirror" \
  "$ROOT/reverse/apktool" \
  "$ROOT/reverse/jadx" \
  "$ROOT/reverse/reports"

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build --platform "$PLATFORM" -t "$IMAGE" -f "$ROOT/docker/apk-tools/Dockerfile" "$ROOT"
fi

exec docker run --rm -it \
  --platform "$PLATFORM" \
  --network none \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --tmpfs /tmp:rw,exec,nosuid,nodev,size=2g \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "$ROOT/artifacts:/work/artifacts:ro" \
  -v "$ROOT/reverse:/work/reverse:rw" \
  -w /work \
  "$IMAGE"

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

docker_args=(
  --rm
  -it
  --platform "$PLATFORM"
  --network bridge
  --cap-drop ALL
  --security-opt no-new-privileges
  --read-only
  --tmpfs /tmp:rw,exec,nosuid,nodev,size=2g
  --user "$(id -u):$(id -g)"
  -e HOME=/tmp
  -v "$ROOT/artifacts:/work/artifacts:rw"
  -v "$ROOT/reverse:/work/reverse:rw"
  -w /work
)

if [[ "${APK_ADB_USB:-0}" == "1" ]]; then
  docker_args+=(--device /dev/bus/usb)
fi

exec docker run "${docker_args[@]}" "$IMAGE"

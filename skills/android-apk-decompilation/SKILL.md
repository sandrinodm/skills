---
name: android-apk-decompilation
description: Use when working with Android APK, APKM, XAPK, or APKS files; pulling installed packages with adb; verifying Android app signatures; sandboxing jadx, apktool, apksigner, and Android platform-tools in Docker; decompiling apps; or extracting static API evidence from authorized Android apps.
---

# Android APK Decompilation

## Overview

Use this skill to acquire, verify, decompile, and statically inspect Android apps in a controlled lab. The core pattern is to separate acquisition from analysis: ADB acquisition may need network access, while static analysis should run in a no-network Docker container with APK inputs mounted read-only.

Use this only for apps, devices, and accounts the user owns or is explicitly authorized to inspect. Treat third-party APK mirror downloads as untrusted until their signer matches a Play-installed copy.

## First Checks

1. Capture scope before touching tools: app name, package id, expected source, version if known, device/account authorization, and research goal.
2. Prefer a Google Play installed copy pulled from an owned Android device. Use APK mirrors only as fallback static evidence.
3. Keep APKs, decompiled source, traffic captures, credentials, tokens, IPs, MACs, account ids, and app secrets out of git unless the user explicitly asks for sanitized artifacts.
4. If TLS pinning, attestation, DRM, anti-tamper, account protection, or terms-of-service boundaries block inspection, pause and reassess instead of treating bypass as the default next step.
5. If the user refers to artifacts or notes from earlier work, look for them first (`artifacts/apk/`, `reverse/`) and say plainly what you found, or that you found nothing, before writing anything that assumes a layout.

## Quick Workflow

1. Scaffold the sandbox templates when the project does not already have them. Copy files from `templates/` into the target repo:
   - `templates/docker/apk-tools/Dockerfile` to `docker/apk-tools/Dockerfile`
   - `templates/scripts/apk-adb-shell.sh` to `scripts/apk-adb-shell.sh`
   - `templates/scripts/apk-analysis-shell.sh` to `scripts/apk-analysis-shell.sh`
   - `templates/scripts/pull-package-apks.sh` to `docker/apk-tools/pull-package-apks.sh`
2. Enter the ADB shell for Play-installed acquisition:
   ```sh
   APK_APP_SLUG=my-app ./scripts/apk-adb-shell.sh
   adb pair PHONE_IP:PAIRING_PORT
   adb connect PHONE_IP:DEBUG_PORT
   pull-package-apks com.example.package artifacts/apk/my-app/play
   ```
3. Enter the static analysis shell:
   ```sh
   APK_APP_SLUG=my-app ./scripts/apk-analysis-shell.sh
   sha256sum artifacts/apk/my-app/play/*.apk > reverse/reports/my-app-SHA256SUMS
   apksigner verify --verbose --print-certs artifacts/apk/my-app/play/base.apk > reverse/reports/my-app-certs.txt
   jadx -d reverse/jadx/my-app artifacts/apk/my-app/play/*.apk
   apktool d -f -o reverse/apktool/my-app artifacts/apk/my-app/play/base.apk
   ```
4. For `.apkm`, `.xapk`, or `.apks` files, treat the bundle as an untrusted ZIP: inside the analysis shell, extract it to `reverse/extracted/<slug>-mirror/` (`artifacts/` is mounted read-only there), verify every APK's signer, pass all split APKs to `jadx`, and decode `base.apk` with `apktool`.
5. Search for evidence, not final truth. Useful first searches:
   ```sh
   rg -n "http|https|okhttp|retrofit|websocket|certificate|pinning|trustmanager|hostnameverifier" reverse/jadx/my-app reverse/apktool/my-app
   rg -n "login|token|authorization|cookie|api|graphql|grpc|webview" reverse/jadx/my-app reverse/apktool/my-app
   rg -n "uses-permission|networkSecurityConfig|usesCleartextTraffic|exported=" reverse/apktool/my-app/AndroidManifest.xml reverse/apktool/my-app/res
   ```
   These patterns already use alternation: ripgrep's default regex is extended. Don't add grep habits (`rg -E` sets the encoding, `rg -I` hides file names), and run any search you hand over once on a small test file, so a broken search can't pass as "no matches".
6. Config splits (`split_config.*.apk`) usually declare no minSdk and carry only v2+ signatures, so plain `apksigner verify` can reject a genuine split. Pass the base APK's minSdk: `apksigner verify --min-sdk-version "$(aapt2 dump badging base.apk | sed -n "s/.*sdkVersion:'\([0-9]*\)'.*/\1/p")" --print-certs split.apk`, and compare every split's signer with `base.apk`'s.
7. Native libraries on a Play split install live in the ABI split (`split_config.arm64_v8a.apk`), not in `base.apk`: unzip `lib/*` from every APK into `reverse/native/<slug>/` before running `strings`.

## What To Document

Create sanitized notes that let future engineering work proceed without re-opening raw APK output:

| Area | Capture |
| --- | --- |
| Provenance | source, package id, version, versionCode, hashes, signer certificate fingerprints |
| Bundle shape | single APK vs split APKs; ABI/density/language splits |
| Manifest | permissions, exported components, app class, deep links, backup/debuggable flags |
| Network policy | network security config, cleartext domains, pinning/trust-manager hints |
| API evidence | endpoint strings, host builders, request/response models, auth token names |
| Native layer | `.so` names, JNI wrappers, strings output, Java callers |
| Confidence | static candidate, observed traffic, replayed request, or productized |

## Common Mistakes

- Installing Android tools on the host when Docker templates are enough.
- Running static analysis with network enabled after acquisition is complete.
- Decompiling only `base.apk` with `jadx` when the app uses split APKs.
- Treating JADX output as authoritative control flow; verify important findings with apktool/smali, runtime behavior, or traffic captures.
- Trusting an APK mirror because the filename looks right; compare signer certificates against a Play-installed copy.
- Committing APKs or decompiled proprietary source instead of sanitized reports, or writing raw search output into `reverse/reports/` (the folder meant for sanitized, committable notes).

## Detailed README

Read `README.md` for the user-facing runbook, including how to download or pull a specific APK by package id, APKPure URL patterns, mirror verification, bundle handling for APKM/XAPK/APKS files, and the full Docker sandbox workflow.

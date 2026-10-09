# Android APK Decompilation Skill

This skill captures a reusable Android APK acquisition, verification, sandboxing, and static-analysis workflow. It intentionally uses neutral app names and package ids so it can be applied to any Android app the user is authorized to inspect.

Use it only for apps, devices, and accounts you own or are explicitly authorized to analyze.

## What This Skill Helps With

- Download or pull a specific Android app APK by package id.
- Avoid host installs by running ADB, JADX, apktool, and apksigner in Docker.
- Verify APK provenance with hashes and signing certificates.
- Decompile APK, APKM, XAPK, and APKS bundles safely.
- Extract static API evidence from manifests, resources, Java-like output, smali, native strings, and network config.
- Produce sanitized notes instead of committing raw APKs or decompiled proprietary code.

## What The Artifact Review Added

The prior project folder had a complete Android reverse-engineering trail: Docker wrappers, an ADB acquisition helper, a no-network static-analysis shell, APKM extraction notes, signature/hash reports, static endpoint/string reports, and planning docs for observation, traffic classification, and sanitization.

The reusable context from those files is:

- Keep ADB acquisition and static analysis as separate Docker modes.
- Prefer wireless debugging on macOS because Docker Desktop does not normally expose Android USB devices to Linux containers.
- Keep `APK_TOOLS_PLATFORM=linux/amd64` unless you have verified another Android SDK toolchain. The Linux Android platform-tools used by the template are x86_64 binaries.
- Treat mirror downloads as untrusted until a signer comparison against a Play-installed copy succeeds.
- Detect HTML challenge pages with `file`, `unzip -t`, and APK signature verification before treating a download as an APK artifact.
- If Docker cannot mount a workspace reliably, copy the APK bundle to a temp workspace and keep only sanitized reports in the repo.
- Record findings with confidence labels: static candidate, observed traffic, replayed request, or productized.

## How To Download Or Acquire A Specific APK

### Preferred: Pull The Play-Installed App From Your Device

This is the cleanest path because it gives you the copy Google Play installed for your account, region, ABI, density, and device.

1. Install the target app from Google Play on an Android device you own.
2. Enable Developer options on the device.
3. Enable Wireless debugging.
4. Select "Pair device with pairing code" and note the pairing IP, pairing port, debug IP/port, and pairing code.
5. Enter the Docker ADB shell:

```sh
APK_APP_SLUG=my-app ./scripts/apk-adb-shell.sh
```

6. Pair, connect, and pull every split APK:

```sh
adb pair PHONE_IP:PAIRING_PORT
adb connect PHONE_IP:DEBUG_PORT
adb devices
adb shell pm path com.example.app
pull-package-apks com.example.app artifacts/apk/my-app/play
```

Replace `com.example.app` with the package id you need. `pm path` may return one APK or several split APKs such as `base.apk`, `split_config.arm64_v8a.apk`, and density splits. The bundled `pull-package-apks` helper pulls all returned paths, writes `package-dumpsys.txt`, and records SHA-256 hashes.

Linux-only optional USB passthrough is possible with `APK_ADB_USB=1`, but it weakens the sandbox and is not the default macOS path. Prefer wireless debugging unless you have a specific reason to pass USB devices through Docker.

### Fallback: Download From APKPure For Static Analysis

Use APKPure only as an untrusted static-analysis source until you compare the signer certificate against a Play-installed copy.

Useful APKPure URL patterns:

| Purpose | URL pattern |
| --- | --- |
| Home | `https://apkpure.com/` |
| Search by app name or package id | `https://apkpure.com/search?q=<url-encoded-query>` |
| App detail page | `https://apkpure.com/<app-slug>/<package-id>` |
| Latest download page | `https://apkpure.com/<app-slug>/<package-id>/download` |
| Version history | `https://apkpure.com/<app-slug>/<package-id>/versions` |

Example with placeholders:

```text
https://apkpure.com/search?q=com.example.app
https://apkpure.com/example-app/com.example.app
https://apkpure.com/example-app/com.example.app/download
https://apkpure.com/example-app/com.example.app/versions
```

APKPure pages commonly use browser-side protections and dynamic download links. Avoid hard-coding `d.apkpure.com` binary URLs as durable automation inputs. Prefer the app detail or `/download` page in a browser, then save the APK/XAPK file under your artifact directory.

If automated download is attempted, confirm the response is actually an APK-like artifact:

```sh
file artifacts/apk/my-app/mirror/*
unzip -t artifacts/apk/my-app/mirror/<filename>.xapk
```

Reject responses identified as HTML, especially Cloudflare or "Just a moment" challenge pages.

### Other Mirror Formats

Some mirrors produce `.apk`; others produce split bundles:

- `.apkm`: APKMirror bundle, ZIP-like container.
- `.xapk`: APKPure-style bundle, ZIP-like container.
- `.apks`: bundletool archive, ZIP-like container.

Store downloads under a clearly labeled path:

```text
artifacts/apk/<app-slug>/mirror/<filename>.apk
artifacts/apk/<app-slug>/mirror/<filename>.apkm
artifacts/apk/<app-slug>/mirror/<filename>.xapk
artifacts/apk/<app-slug>/mirror/<filename>.apks
```

Hash immediately:

```sh
sha256sum artifacts/apk/<app-slug>/mirror/* > reverse/reports/<app-slug>-mirror-SHA256SUMS
```

Extract bundle formats as ZIPs:

```sh
mkdir -p artifacts/apk/<app-slug>/mirror-extracted
unzip artifacts/apk/<app-slug>/mirror/<filename>.xapk -d artifacts/apk/<app-slug>/mirror-extracted
```

## Decompile Workflow

Enter the network-disabled analysis container:

```sh
APK_APP_SLUG=my-app ./scripts/apk-analysis-shell.sh
```

For Play-installed split APKs:

```sh
sha256sum artifacts/apk/my-app/play/*.apk > reverse/reports/my-app-SHA256SUMS
for apk in artifacts/apk/my-app/play/*.apk; do
  apksigner verify --verbose --print-certs "$apk" > "reverse/reports/my-app-$(basename "$apk").certs.txt"
done
jadx -d reverse/jadx/my-app artifacts/apk/my-app/play/*.apk
apktool d -f -o reverse/apktool/my-app artifacts/apk/my-app/play/base.apk
```

For APKM/XAPK/APKS bundles:

```sh
mkdir -p artifacts/apk/my-app/mirror-extracted
unzip "artifacts/apk/my-app/mirror/my-app.xapk" -d artifacts/apk/my-app/mirror-extracted
for apk in artifacts/apk/my-app/mirror-extracted/*.apk; do
  apksigner verify --verbose --print-certs "$apk" > "reverse/reports/my-app-mirror-$(basename "$apk").certs.txt"
done
jadx -d reverse/jadx/my-app-mirror artifacts/apk/my-app/mirror-extracted/*.apk
apktool d -f -o reverse/apktool/my-app-mirror artifacts/apk/my-app/mirror-extracted/base.apk
```

Compare Play and mirror signer reports before trusting mirror evidence:

```sh
diff -u reverse/reports/my-app-base.apk.certs.txt reverse/reports/my-app-mirror-base.apk.certs.txt
```

If the signer differs, keep the mirror artifact out of product decisions.

## Useful Searches

```sh
rg -n "uses-permission|networkSecurityConfig|usesCleartextTraffic|exported=" reverse/apktool/my-app/AndroidManifest.xml reverse/apktool/my-app/res
rg -n "http|https|okhttp|retrofit|volley|websocket|webview|grpc|graphql" reverse/jadx/my-app reverse/apktool/my-app
rg -n "token|authorization|cookie|session|login|logout|refresh" reverse/jadx/my-app reverse/apktool/my-app
rg -n "certificate|pinning|trustmanager|hostnameverifier|network_security_config" reverse/jadx/my-app reverse/apktool/my-app
```

For native-heavy apps, extract strings from `.so` files inside the APK or apktool output and search for endpoint-like evidence:

```sh
find reverse/apktool/my-app -name '*.so' -print
strings reverse/apktool/my-app/lib/arm64-v8a/libSomething.so | rg "http|api|login|token|/v[0-9]/"
```

## Beyond Static Decompilation

Static decompilation is evidence, not proof. When the goal is API reconstruction, pair static findings with authorized observation:

- Record app journeys and whether each action is read-only or mutating.
- Capture `adb logcat` around each journey and sanitize it before saving.
- Classify network traffic by host, protocol, port, and whether it belongs to the app, OS, cloud services, analytics, or the local device.
- Capture HTTP(S) only where authorization and terms permit.
- Promote endpoint confidence only after traffic observation or safe request replay.

## Artifact Policy

Do not commit:

- APK, APKM, XAPK, or APKS files.
- Decompiled proprietary source or copied app resources.
- Raw traffic captures.
- Device, app, account, or network credentials.
- Session cookies, bearer tokens, refresh tokens, API keys, private keys, serial numbers, MAC addresses, or public IPs.

Commit only sanitized notes:

- Source, version, package id, hashes, and certificate fingerprints.
- Endpoint candidates and confidence levels.
- Request/response shapes with placeholder values.
- Parser assumptions and unknowns.
- Reproducible command logs that do not contain secrets.

## Expected Output From An Agent Using The Skill

For research tasks, produce a compact report with:

1. Scope and authorization assumptions.
2. Acquisition method and provenance.
3. Signature and hash results.
4. Decompile status for JADX and apktool.
5. Manifest and network-security findings.
6. Endpoint/auth/model candidates.
7. Sanitized artifact paths.
8. Follow-up validation steps.

# Sandrino's Skills

Personal skills for Codex and other agents that support the `skills.sh` skill format.

## Install

Install a skill with the `skills.sh` CLI:

```bash
npx skills add sandrinodimattia/skills --skill <skill-name>
```

## Skills

| Skill | Description | Install |
| --- | --- | --- |
| [Android APK Decompilation](./skills/android-apk-decompilation) | Acquire, verify, sandbox, and decompile Android APK/APKM/XAPK/APKS artifacts with Dockerized ADB, JADX, apktool, and apksigner. | `npx skills add sandrinodimattia/skills --skill android-apk-decompilation` |
| [GitHub Code Search](./skills/github-code-search) | Search GitHub for similar code examples using the ghx CLI, with GitHub CLI authentication and npm install checks. | `npx skills add sandrinodimattia/skills --skill github-code-search` |
| [Product Name Finder](./skills/product-name-finder) | Generate strategic company, product, platform, feature, and sub-brand names using a professional naming workflow inspired by David Placek's work at Lexicon Branding. | `npx skills add sandrinodimattia/skills --skill product-name-finder` |

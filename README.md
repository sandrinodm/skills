# Sandrino's Skills

Personal skills for Codex and other agents that support the `skills.sh` skill format. Browse them at <https://sandrinodm.github.io/skills/>.

## Install

Install a skill with the `skills.sh` CLI:

```bash
pnpx skills add sandrinodm/skills --skill <skill-name>
```

## Skills

| Skill | Description | Install |
| --- | --- | --- |
| [Android APK Decompilation](./skills/android-apk-decompilation) | Acquire, verify, sandbox, and decompile Android APK/APKM/XAPK/APKS artifacts with Dockerized ADB, JADX, apktool, and apksigner. | `pnpx skills add sandrinodm/skills --skill android-apk-decompilation` |
| [GitHub Code Search](./skills/github-code-search) | Search GitHub for similar code examples using the ghx CLI, with GitHub CLI authentication and npm install checks. | `pnpx skills add sandrinodm/skills --skill github-code-search` |
| [Product Name Finder](./skills/product-name-finder) | Generate strategic company, product, platform, feature, and sub-brand names using a professional naming workflow inspired by David Placek's work at Lexicon Branding. | `pnpx skills add sandrinodm/skills --skill product-name-finder` |

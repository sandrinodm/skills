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
| [Crisp Diagrams](./skills/crisp-diagrams) | Draw clean, minimal explanatory diagrams as standalone SVG files with thin outlines, one blue accent, a takeaway title, and automatic dark mode. Browse examples in the [diagram explorer](https://sandrinodm.github.io/skills/crisp-diagrams/). | `pnpx skills add sandrinodm/skills --skill crisp-diagrams` |
| [GitHub Code Search](./skills/github-code-search) | Search GitHub for similar code examples using the ghx CLI, with GitHub CLI authentication and npm install checks. | `pnpx skills add sandrinodm/skills --skill github-code-search` |
| [Product Name Finder](./skills/product-name-finder) | Generate strategic company, product, platform, feature, and sub-brand names using a professional naming workflow inspired by David Placek's work at Lexicon Branding. | `pnpx skills add sandrinodm/skills --skill product-name-finder` |
| [TypeScript Code Style](./skills/ts-code-style) | Write, review and refactor TypeScript that reads like careful human work: spaced-out steps, named constants, one home for errors, plain-English comments, Total TypeScript type design with Effect Schema over Zod, kebab-case files with colocated tests, and a behavior-preserving cleanup workflow with a string-diff check. | `pnpx skills add sandrinodm/skills --skill ts-code-style` |

### Recommended models for TypeScript Code Style

- **Claude Code:** Claude Haiku 5.5 at high effort. Use Claude Sonnet 5.5 at medium effort when you want faster turnaround.
- **Codex:** GPT-6.1 Sol at medium effort.
- **Avoid:** GPT-6.1 Terra at any effort, and Sonnet 5.5 at low effort. Both skip a lot of the cleanup.
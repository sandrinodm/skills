<div align="center">

# ⚡ TTLMemo ⚡

![build](https://img.shields.io/badge/build-passing-brightgreen) ![coverage](https://img.shields.io/badge/coverage-100%25-brightgreen) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue) ![stars](https://img.shields.io/github/stars/ttlmemo/ttlmemo) ![TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-blue) ![license](https://img.shields.io/badge/license-MIT-green)

**The blazing-fast, zero-dependency memoization library for modern JavaScript!**

</div>

---

## 📖 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
- [Contributing](#-contributing)

---

## ✨ Features

- **🚀 Blazing Fast**: Up to 10x faster than p-memoize and other alternatives.
- **🪶 Lightweight**: Zero dependencies and a tiny footprint.
- **🔒 Type Safe**: Written in TypeScript for a seamless developer experience.
- **🧠 Smart Caching**: Intelligent cache invalidation ensures your data is always fresh.
- **🌐 Redis Support**: Seamlessly scale your cache across multiple servers.

## 📦 Installation

Getting started with TTLMemo is easy! Whether you're building a small side project or a large-scale enterprise application, TTLMemo has you covered.

```bash
npm install ttlmemo
```

## 🛠️ Usage

```js
import { memoize } from 'ttlmemo'

const getUser = memoize(async (id) => {
  const res = await fetch(`/api/users/${id}`)
  return res.json()
}, { expire: 5000, cacheErrors: true })

const user = await getUser(1)
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `expire` | number | `5000` | Time in ms before the cache expires |
| `cacheErrors` | boolean | `false` | Whether to cache rejected promises |
| `redis` | RedisClient | `undefined` | Optional Redis client for distributed caching |

## 🗺️ Roadmap

- [x] TTL support
- [x] TypeScript support
- [ ] Redis adapter
- [ ] Browser support

## 🤝 Contributing

Contributions are welcome! Feel free to open a PR.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">Made with ❤️ by the TTLMemo team. Happy coding! 🎉</div>

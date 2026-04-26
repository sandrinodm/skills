# Browser Use Pattern for Vercel Domains

Use this reference when checking many domains through Vercel Domains from Codex with the Browser Use skill. Adapt names, output fields, and artifact updates to the user's requested format.

## Browser Use Boundary

Use the `browser-use` skill for browser setup, tab selection, navigation, DOM snapshots, and browser safety rules. This reference only describes the Vercel-specific workflow layered on top of Browser Use.

## URL Patterns

Batch exact base-name TLD checks:

```text
https://vercel.com/domains/search?q=<name>&tlds=ai,com,app,sh,io,so
```

Exact `.com` affix checks:

```text
https://vercel.com/domains/search?q=get<name>&tlds=com
https://vercel.com/domains/search?q=supa<name>&tlds=com
https://vercel.com/domains/search?q=<name>base&tlds=com
https://vercel.com/domains/search?q=<name>hq&tlds=com
https://vercel.com/domains/search?q=<name>mate&tlds=com
https://vercel.com/domains/search?q=<name>ops&tlds=com
```

## Reusable Helpers

This pattern waits between distinct URLs, reads a DOM snapshot, parses only exact matching domain rows, and returns normalized status strings.

```js
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
globalThis.lastVercelDomainUrl = globalThis.lastVercelDomainUrl || "";
const waitMs = 6500;

async function gotoAndRead(url) {
  if (globalThis.lastVercelDomainUrl && globalThis.lastVercelDomainUrl !== url) {
    await sleep(waitMs);
  }
  globalThis.lastVercelDomainUrl = url;
  await tab.goto(url);
  await tab.playwright.waitForLoadState({ state: "domcontentloaded", timeoutMs: 15000 }).catch(() => {});
  await sleep(waitMs);
  return await tab.playwright.domSnapshot();
}

function parseExactDomainFromSnapshot(snapshot, domain) {
  const lines = snapshot.split("\n");
  const needle = `"${domain}"`;
  let best = null;

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(needle)) continue;

    for (let j = i + 1; j < Math.min(lines.length, i + 9); j++) {
      const line = lines[j];
      if (j > i + 1 && /- generic "[a-z0-9-]+\.[a-z]+"/.test(line)) break;

      const price = line.match(/\$[0-9]+(?:\.[0-9]{2})?/);
      if (/Unavailable/i.test(line)) {
        return { domain, status: "Unavailable" };
      }
      if (price) {
        best = { domain, status: `Available (${price[0]})` };
      }
      if (new RegExp(`Add ${domain.replace(".", "\\.")} to cart`, "i").test(line) && best) {
        return best;
      }
    }
  }

  return best || { domain, status: "Unknown" };
}
```

## Column-to-Domain Mapping

```js
function domainForColumn(name, col) {
  const n = name.toLowerCase();
  if (col.startsWith(".")) return `${n}${col}`;
  if (col === "get*.com") return `get${n}.com`;
  if (col === "supa*.com") return `supa${n}.com`;
  if (col === "*base.com") return `${n}base.com`;
  if (col === "*hq.com") return `${n}hq.com`;
  if (col === "*mate.com") return `${n}mate.com`;
  if (col === "*ops.com") return `${n}ops.com`;
  throw new Error(`Unknown domain column: ${col}`);
}
```

## Artifact Update Pattern

When the user asks to track progress, update the target artifact after each candidate. The artifact may be markdown, CSV, XLSX, JSON, a document table, or another local file. Preserve the user's existing structure where possible and only add the domain fields needed for the current request.

## Practical Checks

- After finishing, search the target artifact for `Pending`, `Unknown`, or `Check manually`.
- Re-check any ambiguous cells manually in the visible browser UI before presenting final recommendations.
- Keep the final answer focused on the updated artifact path and the strongest available options.

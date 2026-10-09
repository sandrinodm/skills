#!/usr/bin/env python3
"""Check domain availability and price for naming candidates.

usage: python3 check_domains.py Stevin Paceline perpend.com [--tlds com,ai,nl] [--file names.txt] [--json]

Names without a dot are expanded with --tlds (default: com,ai). For TLDs that Vercel's registrar
sells, availability, price, renewal price and the premium flag come from Vercel's
registrar API (POST https://api.vercel.com/v1/registrar/domains/search, no account or token,
up to 200 domains per request). Vercel reports every TLD it doesn't sell (.nl, .be, .de, .eu,
.co.uk, ...) as unavailable whether or not anyone owns it, so those go to the registry's RDAP
service instead (registered or not, no price). TLDs without RDAP (.be, .de, .eu, .at, .ch, ...)
fall back to DNS, then whois.

Prices are shown per year. Some TLDs are only sold for a minimum term (.ai: 2 years), so the
"term" column says how many years the registrar's price covers and "term price" what you pay up front.

Statuses: available, premium (available at a premium price), taken, registered, not registered,
unknown. "taken" and "registered" only mean someone holds the domain: check what's live there.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

VERCEL = "https://api.vercel.com/v1/registrar"
RDAP_BOOTSTRAP = "https://data.iana.org/rdap/dns.json"
LABEL = re.compile(r"^(?!-)[a-z0-9-]{1,63}(?<!-)$")
HEADERS = {"User-Agent": "product-name-finder/1.0", "Accept": "application/json"}
EMPTY = {"status": "unknown", "price": None, "renewal": None, "term": None, "term_price": None, "source": "-"}


def http_json(url, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(HEADERS, **({"Content-Type": "application/json"} if data else {}))
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if data else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read().decode() or "null")


def normalize(name):
    """'Pace Line' -> 'paceline'; returns None if it can't be a domain label."""
    label = re.sub(r"[^a-z0-9-]", "", name.strip().lower().replace(" ", ""))
    return label if LABEL.match(label) else None


def expand(items, tlds):
    domains, rejected = [], []
    for item in items:
        item = item.strip().lower()
        if not item:
            continue
        if "." in item:
            labels = item.split(".")
            (domains if all(LABEL.match(l) for l in labels) else rejected).append(item)
            continue
        label = normalize(item)
        if label:
            domains += [f"{label}.{t}" for t in tlds]
        else:
            rejected.append(item)
    return list(dict.fromkeys(domains)), rejected


def supported_tlds():
    _, data = http_json(f"{VERCEL}/tlds/supported")
    return set(data if isinstance(data, list) else data.get("tlds", []))


def vercel_search(domains):
    results = {}
    for i in range(0, len(domains), 200):
        batch = domains[i:i + 200]
        for attempt in range(4):
            try:
                _, data = http_json(f"{VERCEL}/domains/search", {"domains": batch})
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt < 3:
                    try:
                        wait = json.loads(e.read().decode()).get("retryAfter", {}).get("value", 10)
                    except Exception:
                        wait = 10
                    time.sleep(min(float(wait), 60))
                    continue
                raise
        for r in data["results"]:
            if r.get("available"):
                years = r.get("years") or 1
                per_year = lambda v: None if v is None else round(v / years, 2)
                results[r["domain"]] = {"status": "premium" if r.get("premium") else "available",
                                        "price": per_year(r.get("price")), "renewal": per_year(r.get("renewalPrice")),
                                        "term": years, "term_price": r.get("price"), "source": "vercel"}
            else:
                results[r["domain"]] = dict(EMPTY, status="taken", source="vercel")
    return results


def rdap_servers():
    try:
        _, data = http_json(RDAP_BOOTSTRAP)
    except Exception:
        return {}
    servers = {}
    for tlds, urls in data.get("services", []):
        for t in tlds:
            servers[t] = urls[0].rstrip("/") + "/"
    return servers


FREE_WHOIS = re.compile(r"status:\s*(free|available)|\bis free\b|no match|not found|nothing found|"
                        r"no entries found|no data found", re.I)
WHOIS_LIMIT = re.compile(r"limit exceeded|quota exceeded|too many requests|try again later", re.I)


def dns_status(domain):
    if not shutil.which("dig"):
        return "unknown"
    out = subprocess.run(["dig", "NS", domain, "+noall", "+comments", "+answer", "+time=5", "+tries=2"],
                         capture_output=True, text=True).stdout
    if "status: NXDOMAIN" in out:
        return "not registered"
    if "status: NOERROR" in out:
        return "registered"
    return "unknown"  # SERVFAIL or timeout: usually a registered domain with broken name servers; whois decides


def whois_status(domain):
    if not shutil.which("whois"):
        return "unknown"
    try:
        out = subprocess.run(["whois", domain], capture_output=True, text=True, timeout=20).stdout
    except subprocess.TimeoutExpired:
        return "unknown"
    if not out.strip() or WHOIS_LIMIT.search(out):
        return "unknown"
    return "not registered" if FREE_WHOIS.search(out) else "registered"


def registry_check(domain, servers):
    tld = domain.rsplit(".", 1)[1]
    base = servers.get(tld)
    for attempt in range(3 if base else 0):
        try:
            req = urllib.request.Request(base + "domain/" + domain, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=20):
                return dict(EMPTY, status="registered", source="rdap")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return dict(EMPTY, status="not registered", source="rdap")
            time.sleep(2 * (attempt + 1))  # 429 or a registry hiccup: back off and retry
        except Exception:
            time.sleep(2 * (attempt + 1))
    status = dns_status(domain)
    if status != "unknown":
        return dict(EMPTY, status=status, source="dns")
    return dict(EMPTY, status=whois_status(domain), source="whois")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="candidate names (expanded with --tlds) or full domains")
    ap.add_argument("--tlds", default="com,ai", help="comma-separated TLDs for bare names (default: com,ai)")
    ap.add_argument("--file", help="read more names or domains from this file, one per line")
    ap.add_argument("--json", action="store_true", help="print JSON instead of a table")
    args = ap.parse_args()
    items = list(args.names)
    if args.file:
        items += open(args.file, encoding="utf-8").read().splitlines()
    tlds = [t.strip().lstrip(".").lower() for t in args.tlds.split(",") if t.strip()]
    domains, rejected = expand(items, tlds)
    if not domains:
        ap.error("no valid names or domains given")

    sold = supported_tlds()
    vercel_domains = [d for d in domains if d.split(".", 1)[1] in sold or d.rsplit(".", 1)[1] in sold]
    other = [d for d in domains if d not in set(vercel_domains)]
    results = vercel_search(vercel_domains) if vercel_domains else {}
    if other:
        servers = rdap_servers()
        with ThreadPoolExecutor(max_workers=4) as pool:
            for d, r in zip(other, pool.map(lambda d: registry_check(d, servers), other)):
                results[d] = r

    rows = [dict(domain=d, **results.get(d, EMPTY)) for d in domains]
    if args.json:
        print(json.dumps({"results": rows, "rejected": rejected}, indent=2))
        return
    money = lambda v: "" if v is None else f"${v:,.2f}"
    width = max(len(r["domain"]) for r in rows)
    print(f"{'domain':<{width}}  {'status':<14}  {'per year':>9}  {'renewal/yr':>10}  {'term':>5}  {'term price':>10}  source")
    for r in rows:
        term = f"{r['term']}y" if r["term"] else ""
        print(f"{r['domain']:<{width}}  {r['status']:<14}  {money(r['price']):>9}  {money(r['renewal']):>10}  "
              f"{term:>5}  {money(r['term_price']):>10}  {r['source']}")
    if rejected:
        print("\nskipped (not a valid domain name): " + ", ".join(rejected), file=sys.stderr)
    if any(r["source"] != "vercel" for r in rows):
        print("\nrdap/dns/whois rows: Vercel doesn't sell that TLD, so the registry was asked instead (no price).", file=sys.stderr)


if __name__ == "__main__":
    main()

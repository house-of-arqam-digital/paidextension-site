# paidextension.dev

Marketing and docs site for [PaidExtension](https://paidextension.dev), the
$0/month stack for paid browser extensions. Static HTML/CSS served from `docs/`
by GitHub Pages; the kit itself lives in the private `paidextension` repo.

```bash
npm ci
npm run check   # eslint, html-validate, local link check, CSP check
npm run serve   # http://localhost:8898
```

- `docs/CNAME` pins the custom domain; `paidextension.com` redirects here at the Cloudflare edge.
- Every page carries a strict `<meta>` CSP (GitHub Pages cannot set headers); `scripts/check-csp.js` guards it.
- Buy links point at the Polar storefront. Update them in every `docs/*.html` when the product URL changes.

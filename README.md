# elizaresearch.ai

Company website for Eliza Research: https://elizaresearch.ai.
A self-contained HTML page with local images and fonts; no application build or framework dependencies.

## Development

Use Bun 1.3.14 and Node 24.15.0.

```sh
bun install --frozen-lockfile
bun test
bun run preview
bun run deploy:check
```

Preview runs on http://localhost:4173 using Cloudflare's local assets server, including `_headers` behavior.
Only `public/` is deployed; tooling and operational documentation remain outside the served directory.

## Deployment

`bun run deploy` updates the existing Cloudflare Worker `elizaresearch` and its custom domain `elizaresearch.ai`. Keep the existing account and Worker; repository migration does not require domain registration, nameserver, or email DNS changes.

GitHub Actions checks pull requests and main pushes. The Deploy workflow is manually dispatched from `main`, repeats the checks, and uses the `production` environment. Configure its `CLOUDFLARE_API_TOKEN` secret and `CLOUDFLARE_ACCOUNT_ID` variable before running it. Use a Cloudflare deployment token scoped to the owning account and required Worker/domain permissions. Never commit credentials.

For attended deployment, authenticate with `bunx wrangler login`, then run `bun run deploy` from a clean, tested checkout of this repository. Record the source commit and returned deployment version in the release record. To roll back, use `bunx wrangler rollback <previous-version-id>` after checking the version with `bunx wrangler deployments list`.

## Email operations

`bun run mail:security` audits live DNS. See [MAIL-SECURITY.md](MAIL-SECURITY.md) for the operational runbook; its historical observations are not a current DNS attestation.

## Source provenance

Extracted from `elizaOS/eliza`, directory `packages/elizaresearch`, at commit `a2665f15af93dcb56434081b7cc4825d8cc243e7`.
The available history from the source checkout's shallow boundary is retained; older history remains in the [original repository](https://github.com/elizaOS/eliza/tree/a2665f15af93dcb56434081b7cc4825d8cc243e7/packages/elizaresearch).
Migration tracking: https://github.com/elizaOS/eliza/issues/31444.

## Research deck

The seven-slide senior independence deck lives in `deck/public/` and is deployed independently at https://deck.elizaresearch.ai using the `elizaresearch-deck` Worker.

- `bun run deck:preview` — preview at http://localhost:4184.
- `bun run deck:deploy:check` — validate slide structure, assets, JavaScript, and Worker configuration.
- `bun run deck:deploy` — deploy only the deck and its custom subdomain.

Navigation supports arrow keys, Space, Page Up/Down, Home/End, desktop edge clicks, horizontal touch swipes, previous/next buttons, and the slide picker. Each slide has a stable hash URL. Dense slides scroll vertically on small screens. Inactive slides are inert and hidden from assistive technology. Reduced-motion and landscape print layouts are included.

The **Deploy deck** GitHub workflow uses the existing production environment credentials. For attended deployment, the existing Wrangler login can be used. The root company website has a separate Worker/configuration. See `deck/SOURCE.md` for reference provenance and `deck/RELEASE.md` for verification.

# Research deck release — September 15, 2026

- URL: https://deck.elizaresearch.ai/
- Cloudflare Worker: `elizaresearch-deck`
- Initial deployed version: `3c3df07b-afa1-4430-b53a-9fce56503c69`
- Only `deck/public/` is served; the company website uses its existing separate Worker.

## Verification

All seven slides visually reviewed at 1440×900 and 390×844. All seven checked for horizontal overflow at 320×568, 768×1024, and 1366×768; the small-phone cover overflow was fixed and visually rechecked. Dense phone slides scroll vertically within the presentation, with navigation fixed below them. Desktop and laptop slides fit without vertical scrolling.

Verified arrow keys, Space, Page Up/Down, Home/End, next/previous buttons, slide picker, desktop edge click, hash reload, malformed-hash recovery, inactive-slide `inert` and `aria-hidden` attributes, and reduced-motion behavior. Synthetic browser TouchEvents verified left/right swipes and that vertical movement does not change slides. No browser console warnings or errors in the final local interaction checks.

`bun test`: 26 passed. `bun run deck:check`, both Worker dry runs, and `git diff --check` passed. The HTML, CSS, JavaScript, font, and logo were fetched from production over certificate-verified HTTPS and compared byte-for-byte with the local files.

Cloudflare authoritative DNS, 1.1.1.1, and 8.8.8.8 returned the new hostname. The local recursive resolver initially cached NXDOMAIN; initial production byte verification used the published Cloudflare IP with curl `--resolve`, preserving the actual hostname and TLS certificate validation.

## Future deployment

Use `bun run deck:deploy` from the checked source or dispatch **Deploy deck** on `main` using the existing production environment credentials (verified present). Only the deck configuration should be used for deck deployments.

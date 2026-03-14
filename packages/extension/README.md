# @fabric-vault/extension

The FabricVault Chrome extension. Built with [Plasmo](https://docs.plasmo.com).

## Development

```bash
pnpm dev
```

Plasmo compiles to `build/chrome-mv3-dev` with hot reload. To load it:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `build/chrome-mv3-dev`

## Build

```bash
pnpm build      # outputs to build/chrome-mv3-prod
pnpm package    # zips for Chrome Web Store submission
```

## Architecture

| File | Role |
| ---- | ---- |
| `src/popup.tsx` | Extension popup — React app entry point |
| `src/background.ts` | Service worker — routes messages, manages vault state, keeps WebSocket alive |
| `src/content.ts` | Content script — bridges webpage messages to the background |
| `src/injected.ts` | Injected into every page — exposes `window.fabric` and handles provider discovery |
| `src/pages/` | Individual UI screens (dashboard, add identity, sign request, etc.) |
| `src/contexts/` | React contexts for vault, identity, peer, connection, and request state |

**Message flow:** webpage → `injected.ts` → `content.ts` → `background.ts` → Fabric network via gateway

**Provider discovery:** `injected.ts` dispatches `fabric:announceProvider` on load and responds to `fabric:requestProvider` events, following the same pattern as EIP-6963.

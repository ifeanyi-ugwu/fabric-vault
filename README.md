# FabricVault

A browser extension wallet for Hyperledger Fabric — lets dApps request transaction signing without ever handling private keys, in the same pattern as MetaMask for EVM chains.

**[Documentation](https://ifeanyiugwu.github.io/fabric-vault/)**

---

## Packages

| Package | Description |
| ------- | ----------- |
| [`packages/extension`](packages/extension) | Chrome extension — identity vault, transaction signing, provider API |
| [`packages/sdk`](packages/sdk) | TypeScript SDK for dApps to discover and connect to the extension |
| [`packages/gateway`](packages/gateway) | JSON-RPC WebSocket gateway bridging the browser to Fabric peers |
| [`packages/types`](packages/types) | Shared TypeScript types |
| [`apps/docs`](apps/docs) | VitePress documentation site |

---

## Getting Started

1. Install the FabricVault extension from the Chrome Web Store (link TBD)
2. Configure at least one peer and one identity in the extension dashboard
3. Run the JSON-RPC gateway alongside your Fabric network:

   ```bash
   npx @fabric-vault/gateway
   ```

4. Use the SDK in your dApp to connect:

   ```ts
   import { waitForProvider, FabricVaultClient } from "@fabric-vault/sdk"

   const { info, provider } = await waitForProvider()
   const client = new FabricVaultClient(provider, info)
   const identities = await client.connect()
   ```

See the [Getting Started guide](https://ifeanyiugwu.github.io/fabric-vault/guide/) for full setup instructions.

---

## Development

Requires [pnpm](https://pnpm.io) and Node 20+.

```bash
pnpm install
pnpm build        # build all packages
pnpm dev          # watch mode for all packages
```

To work on a specific package:

```bash
pnpm --filter @fabric-vault/extension dev
pnpm --filter @fabric-vault/sdk dev
pnpm --filter @fabric-vault/gateway dev
pnpm --filter @fabric-vault/docs dev
```

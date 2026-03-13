# Provider Discovery

Fabric Vault uses an EIP-6963-style discovery protocol over custom DOM events.

## Multi-provider (wallet picker)

Use `requestProviders` when you want to let the user choose between multiple
installed Fabric wallets:

```ts
import { requestProviders, FabricVaultClient } from "@fabric-vault/sdk"

const cleanup = requestProviders(({ info, provider }) => {
  console.log("Found wallet:", info.name)
  const client = new FabricVaultClient(provider, info)
  // render a wallet picker, then call cleanup() once the user picks one
})
```

## Single-provider shortcut

`waitForProvider` resolves with the first wallet that announces itself:

```ts
import { waitForProvider, FabricVaultClient } from "@fabric-vault/sdk"

const { info, provider } = await waitForProvider(3000) // 3 s timeout
const client = new FabricVaultClient(provider, info)
```

## How it works

1. The SDK fires `fabric:requestProvider` on `window`.
2. The extension (via its injected script) hears the event and fires back
   `fabric:announceProvider` with its `FabricProviderInfo` and `FabricProvider`.
3. The SDK hands these to your callback or resolves the promise.

# @fabric-vault/sdk

TypeScript SDK for connecting dApps to the [FabricVault](https://ifeanyiugwu.github.io/fabric-vault/) browser extension.

## Install

```bash
npm install @fabric-vault/sdk
```

## Usage

```ts
import { waitForProvider, FabricVaultClient } from "@fabric-vault/sdk"

// Discover the extension and connect
const { info, provider } = await waitForProvider()
const client = new FabricVaultClient(provider, info)

// Prompt the user to grant identity access
const identities = await client.connect()

// Evaluate (read-only)
const result = await client.evaluate({
  channel: "mychannel",
  chaincode: "basic",
  fn: "GetAllAssets",
})

// Submit (writes to ledger)
await client.submit({
  channel: "mychannel",
  chaincode: "basic",
  fn: "TransferAsset",
  args: ["asset6", "Alice"],
})
```

If multiple wallets may be present, use `requestProviders` to enumerate them:

```ts
import { requestProviders, FabricVaultClient } from "@fabric-vault/sdk"

const cleanup = requestProviders(({ info, provider }) => {
  console.log("Found provider:", info.name)
})

// Call cleanup() when done listening
```

## Events

```ts
client
  .onConnect((info) => console.log("connected", info))
  .onDisconnect((err) => console.warn("disconnected", err))
  .onIdentitiesChanged((ids) => console.log("identities updated", ids))
  .onPeerChanged((endpoint) => console.log("peer changed", endpoint))
```

## Requirements

The FabricVault extension must be installed in the user's browser. `waitForProvider` rejects after 3 seconds if no extension is found.

## Full Documentation

[ifeanyiugwu.github.io/fabric-vault](https://ifeanyiugwu.github.io/fabric-vault/)

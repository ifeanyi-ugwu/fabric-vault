# Getting Started

Fabric Vault is a browser extension wallet for Hyperledger Fabric that lets
dApps request transaction signing without ever touching private keys.

## Installation

Install the extension from the Chrome Web Store (link TBD), or load the
unpacked build from `packages/extension/build/chrome-mv3-dev` during
development.

## SDK

Install the SDK in your dApp:

```bash
npm install @fabric-vault/sdk
```

Connect to the wallet in three lines:

```ts
import { waitForProvider, FabricVaultClient } from "@fabric-vault/sdk"

const { info, provider } = await waitForProvider()
const client = new FabricVaultClient(provider, info)
const identities = await client.connect()
```

## Running the Gateway

The JSON-RPC gateway bridges your dApp to a live Fabric network:

```bash
npx @fabric-vault/gateway
```

The gateway starts on port `7545` by default. Override with `PORT` if needed.
Peer and identity details are supplied per-request by the extension — no
upfront configuration is required.

# Demo Setup

The [interactive demos](./examples.md) require three things running together: the FabricVault extension, a Fabric network, and the JSON-RPC gateway.

## Prerequisites

### 1. FabricVault Extension

Install the extension in your browser and configure it with at least one peer and one identity before opening any demo page.

**Adding a peer** (Dashboard → Peers tab):
- Name — e.g. `peer0.org1.example.com`
- Endpoint — e.g. `localhost:7051`
- RPC URL — e.g. `ws://localhost:7545` (self-hosted) or `wss://hyperledger-fabric-json-rpc-gateway.onrender.com` (public, free plan)
- TLS CA Certificate — import the `.crt` file for the peer

For Fabric Samples users, the TLS CA cert for `peer0.org1.example.com` is at:
```
fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/
  peers/peer0.org1.example.com/tls/ca.crt
```

**Adding an identity** (Dashboard → Identities tab):
- Label — a unique name for this identity
- MSP ID — e.g. `Org1MSP`
- Certificate — import the `.pem` cert file
- Private key — paste the key contents

For Fabric Samples users:
```
# Certificate
fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/
  users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem

# Private key (filename ends with _sk)
fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/
  users/User1@org1.example.com/msp/keystore/<YOUR_PRIVATE_KEY_FILE>
```

After adding both, select an active peer and identity in the dashboard.

### 2. Hyperledger Fabric Network

Your network must be running and accessible from the browser's host machine. The demo pages default to `mychannel` and the `basic` asset transfer chaincode from the [Fabric Samples test network](https://hyperledger-fabric.readthedocs.io/en/release-2.5/test_network.html).

### 3. JSON-RPC Gateway

The gateway bridges the browser to your Fabric peers. See the [Getting Started guide](./index.md) for setup instructions.

> The demo pages must be served over HTTP or HTTPS — the extension's injected API is not available on `file://` pages. If running from a local clone, serve the `public/examples/` directory with any HTTP server, e.g. `python -m http.server 8000`, then open `http://localhost:8000/test2.html`.

---

## Using the Demo Pages

### test2.html — Full API Harness

1. **Connect Wallet** — triggers `fabric_requestIdentities`, prompting the extension to grant this page access to your identities
2. **Get Identities** — fetches available identities and populates the identity dropdown; select one before running transactions
3. **Specific Transactions** — pre-built calls using the `basic` chaincode (`GetAllAssets`, `TransferAsset`)
4. **Generic Transaction Builder** — enter channel, chaincode, function, and args to execute any transaction
5. **Event Subscriptions** — subscribe to block or chaincode events on `mychannel`

The **Output & Events** panel logs all responses and incoming events with timestamps. Use **Clear** to reset it.

### test.html — Basic Connect Demo

Simpler page with individual buttons for connect, get identities, evaluate, submit, block subscribe, and chaincode subscribe. Useful for quickly verifying each API call works.

### discovery.html — Provider Discovery Demo

Demonstrates the `fabric:requestProvider` / `fabric:announceProvider` event protocol. Lists discovered providers and lets you connect to each.

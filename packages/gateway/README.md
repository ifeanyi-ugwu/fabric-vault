# Hyperledger Fabric JSON-RPC Gateway

A gateway service that exposes Hyperledger Fabric network interactions via JSON-RPC over WebSockets. This allows client-side applications to interact with a Fabric network without directly managing gRPC connections or complex Fabric SDK dependencies.

---

## Features

- **JSON-RPC 2.0 over WebSockets**: Standardized communication protocol for easy integration.
- **Transaction Submission**:
  - `fabric_evaluateTransaction`: Read-only queries.
  - `fabric_submitTransaction`: Synchronous transaction submission.
  - `fabric_submitAsync`: Asynchronous transaction submission, returns transaction ID.
- **Event Subscription**:
  - `fabric_subscribe` (with `eventType: "chaincode"`): Subscribe to chaincode events.
  - `fabric_subscribe` (with `eventType: "block"`): Subscribe to block events.
  - `fabric_unsubscribe`: End active subscriptions.
- **Dynamic Signer Integration**: The gateway requests signatures from the client for transaction submissions, allowing the client to hold and manage private keys securely.
- **Health Check**: Basic `/health` endpoint for readiness checks.

---

## Installation

```bash
npm install hyperledger-fabric-json-rpc-gateway
# or
pnpm install hyperledger-fabric-json-rpc-gateway
```

---

## Usage

### Running the Gateway

The package includes a CLI tool.

```bash
hfgateway
# or
hyperledger-fabric-json-rpc-gateway
```

By default, the server runs on port `7545`. You can specify a different port using the `PORT` environment variable:

```bash
PORT=8080 hfgateway
```

### Configuration

The gateway holds no keys and accepts any client unless a token is set. Every setting is an environment variable.

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `7545` | Listening port. |
| `GATEWAY_ALLOW_PRIVATE_PEERS` | `false` | Allows peers on loopback, private and link-local addresses. A peer whose host resolves to one of those is otherwise refused, so a client cannot aim the gateway at its own network. Set this to `true` when the gateway runs next to a local Fabric network. |
| `GATEWAY_TOKEN` | unset | When set, a WebSocket upgrade must carry `?token=<value>`. The token appears in proxy access logs, so serve the gateway over `wss://`. |
| `GATEWAY_TRUST_PROXY` | `false` | Keys the per-client connection limit on the first `X-Forwarded-For` entry. Set it only behind a proxy that overwrites that header. |
| `GATEWAY_MAX_CONNECTIONS_PER_IP` | `20` | Simultaneous connections from one client address. |
| `GATEWAY_MAX_PAYLOAD_BYTES` | `1048576` | Largest accepted WebSocket message. |
| `GATEWAY_MESSAGES_PER_SECOND` | `20` | Sustained message rate of one connection. |
| `GATEWAY_MESSAGE_BURST` | `40` | Messages one connection may send at once. A connection that exceeds the rate is closed. |
| `GATEWAY_MAX_BATCH_SIZE` | `20` | Requests in one JSON-RPC batch. |
| `GATEWAY_MAX_CONCURRENT_REQUESTS` | `32` | Requests in flight on one connection. |
| `GATEWAY_MAX_SUBSCRIPTIONS` | `10` | Open subscriptions on one connection. |
| `GATEWAY_FIRST_MESSAGE_TIMEOUT_MS` | `30000` | A connection that sends nothing for this long is closed. |
| `GATEWAY_PING_INTERVAL_MS` | `30000` | Liveness ping interval; a connection that misses one is dropped. |
| `GATEWAY_SIGNATURE_TIMEOUT_MS` | `30000` | How long a call waits for the client's signature. |

The gateway sees every transaction's arguments and results, and the certificate of the identity that sends them, because TLS to the peer ends here. It does not see private keys.

### JSON-RPC Methods

All methods are invoked over a WebSocket connection.

#### `fabric_evaluateTransaction`

Executes a read-only transaction on the ledger.

**Params:**

- `identity`: `{ mspId: string; certificate: string; }` Your Fabric identity.
- `channel`: `string` The channel name.
- `chaincode`: `string | { name: string; contract?: string; }` The chaincode name, optionally with contract name.
- `fn`: `string` The function name to invoke.
- `args`: `string[]` (Optional) Arguments for the function.
- `peer`: `{ name: string; endpoint: string; tlsRootCert?: string; }` Details of the peer to connect to.

**Returns:**

- `any` The result of the transaction.

#### `fabric_submitTransaction`

Submits a transaction to the ledger, waiting for it to be committed.

**Params:** (Same as `fabric_evaluateTransaction`)

**Returns:**

- `any` The result of the transaction.

#### `fabric_submitAsync`

Submits a transaction asynchronously, returning the transaction ID immediately.

**Params:** (Same as `fabric_evaluateTransaction`)

**Returns:**

- `{ transactionId: string }` The ID of the submitted transaction.

#### `fabric_subscribe`

Subscribes to events from the Fabric network.

**Params:**

- `eventType`: `string` (`"chaincode"` or `"block"`) The type of events to subscribe to.
- `identity`: `{ mspId: string; certificate: string; }` Your Fabric identity.
- `channel`: `string` The channel name.
- `chaincode`: `string` (Required for `eventType: "chaincode"`) The chaincode name.
- `peer`: `{ name: string; endpoint: string; tlsRootCert?: string; }` Details of the peer to connect to.
- `startBlock`: `string` (Optional, for `eventType: "block"`) Block number to start receiving events from.

**Returns:**

- `string` A unique ID for the subscription.

**Notifications (`fabric_subscription`):**

When events occur, the client will receive notifications:

- For `eventType: "chaincode"`:

  ```json
  {
    "jsonrpc": "2.0",
    "method": "fabric_subscription",
    "params": {
      "subscription": "yourSubscriptionId",
      "result": {
        "chaincodeName": "mychaincode",
        "blockNumber": "123",
        "transactionId": "tx123",
        "eventName": "MyEvent",
        "payload": "base64EncodedPayload"
      }
    }
  }
  ```

- For `eventType: "block"`:

  ```json
  {
    "jsonrpc": "2.0",
    "method": "fabric_subscription",
    "params": {
      "subscription": "yourSubscriptionId",
      "result": {
        "block": "base64EncodedProtobufBlock"
      }
    }
  }
  ```

#### `fabric_unsubscribe`

Unsubscribes from an active event stream.

**Params:**

- `subscriptionId`: `string` The ID of the subscription to cancel (received from `fabric_subscribe`).

**Returns:**

- `boolean` `true` if the subscription was successfully canceled, `false` otherwise.

### Signature Request (`signDigest` request)

When submitting transactions, the gateway will send a `signDigest` request to the client. The client is expected to sign the digest and send back a JSON-RPC response with the signature.

**Notification:**

```json
{
  "jsonrpc": "2.0",
  "method": "signDigest",
  "params": {
    "digest": "base64EncodedDigest",
    "certificate": "base64EncodedPEMCertificate"
  },
  "id": "requestId"
}
```

**Client Response:**

The client must respond with a JSON-RPC response containing the signature.

```json
{
  "jsonrpc": "2.0",
  "result": {
    "signature": "base64EncodedSignature"
  },
  "id": "requestId"
}
```

---

## Development

```bash
pnpm install
pnpm dev # Runs with tsx-watch
pnpm build # Compiles to dist/
pnpm test # Unit and integration tests
pnpm typecheck
```

---

## Project Structure

- `src/main.ts`: Main entry point for the executable.
- `src/app.ts`: Sets up the Express and WebSocket servers.
- `src/jsonrpc.handler.ts`: Handles incoming JSON-RPC messages and dispatches to `FabricService`.
- `src/fabric.service.ts`: Abstracts Hyperledger Fabric Gateway interactions.
- `src/lib/`: gRPC client and gateway initialization, peer endpoint validation, connection limits and the connection token.

---

## License

ISC

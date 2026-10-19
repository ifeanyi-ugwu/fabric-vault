# ADR-0001: The extension verifies the signed bytes before signing

**Status:** Proposed
**Deciders:** Ifeanyi Ugwu

## Context

Fabric Vault is a browser wallet for Hyperledger Fabric. A dApp asks the extension to run a chaincode call, and the extension holds the private key and signs. A gateway process sits between the extension and the peer:

```
dApp page ──port──▶ extension ──WebSocket JSON-RPC──▶ gateway ──gRPC──▶ peer
                    (keys, approval)                  (builds proposals)
```

The gateway uses the Fabric Gateway client library. The library builds each request, asks a signer callback for a signature over its digest, and sends it to the peer. The callback only receives a digest, so the gateway forwards a bare `signDigest` request to the extension, and the extension signs the digest. The extension cannot tell what the digest covers.

A gateway can therefore obtain a signature from the user's identity over a digest unrelated to the call the user approved. Authorization on the extension side limits when and for which identity a signature may be requested (a grant per approved request, a connected-site check per identity). It does not limit what is signed.

The gateway is meant to be a stateless relay that anyone can host and use, in the way a wallet uses a public RPC endpoint. A wallet can use an endpoint it does not trust only if the wallet checks what it signs.

### What gets signed

One Fabric Gateway call produces up to three signatures, and a subscription produces one:

| Artifact | Digest is SHA-256 of | Produced by |
| --- | --- | --- |
| Proposal | `SignedProposal.proposal_bytes` | evaluate, endorse |
| Transaction | `Envelope.payload` of the endorsed transaction | submit |
| Commit status request | `SignedCommitStatusRequest.request` | commit status |
| Chaincode events request | `SignedChaincodeEventsRequest.request` | chaincode event subscription |
| Block events request | `Envelope.payload` (a `SeekInfo` payload) | block event subscription |

`evaluateTransaction` signs one proposal. `submitTransaction` signs a proposal, a transaction and a commit status request. `submitAsync` signs a proposal and a transaction.

### Constraints

- The extension is published on the Chrome Web Store and Firefox Add-ons. Manifest V3 on Chrome, Manifest V2 on Firefox.
- The extension bundle is about 388 KB of JavaScript.
- The wire format between extension and gateway can change, and extensions update independently of gateways.
- One maintainer.

## Decision

The gateway sends the serialized material to be signed. The extension decodes it, checks it against the request the user approved, computes the digest itself, and signs. A request that fails a check is refused with a JSON-RPC error.

### Protocol

The gateway sends `signRequest` to the extension:

```json
{
  "jsonrpc": "2.0",
  "method": "signRequest",
  "params": { "kind": "proposal", "bytes": "<base64>", "certificate": "<PEM>" },
  "id": "<request id>"
}
```

The extension answers with `{ "result": { "signature": "<base64>" } }` or `{ "error": { "code": -32001, "message": "…" } }`.

| `kind` | `bytes` is the output of | Library call that consumes the signature |
| --- | --- | --- |
| `proposal` | `Proposal.getBytes()` (`ProposedTransaction`) | `newSignedProposal` |
| `transaction` | `Transaction.getBytes()` (`PreparedTransaction`) | `newSignedTransaction` |
| `commit` | `Commit.getBytes()` (`SignedCommitStatusRequest`) | `newSignedCommit` |
| `chaincodeEvents` | `ChaincodeEventsRequest.getBytes()` (`SignedChaincodeEventsRequest`) | `newSignedChaincodeEventsRequest` |
| `blockEvents` | `BlockEventsRequest.getBytes()` (`Envelope`) | `newSignedBlockEventsRequest` |

The extension advertises `"capabilities": ["signRequest"]` in the params of each request it sends to the gateway. The gateway uses `signRequest` for a connection that advertises it and `signDigest` otherwise.

### Verification

The extension records the approved call (channel, chaincode, contract, function, arguments, identity) when the user approves. It checks each `signRequest` against that record.

| `kind` | Checks | Recorded |
| --- | --- | --- |
| `proposal` | Channel header type is `ENDORSER_TRANSACTION`. `channel_id` equals the approved channel. `ChaincodeID.name` equals the approved chaincode. The first argument equals the function, prefixed `contract:` when a contract is set, and the remaining arguments equal the approved arguments byte for byte. The creator's `mspid` and certificate equal the approved identity. The transient map is empty. | `tx_id`, channel, creator |
| `transaction` | `channel_id`, `tx_id` and creator equal the recorded proposal. Every action's `chaincode_proposal_payload` decodes to the approved chaincode and arguments. | none |
| `commit` | `channel_id`, `transaction_id` and `identity` equal the recorded proposal. | none |
| `chaincodeEvents` | `channel_id` equals the subscription's channel, `chaincode_id` equals the subscription's chaincode, `identity` equals the approved identity. | none |
| `blockEvents` | Channel header type is `DELIVER_SEEK_INFO`. `channel_id` equals the subscription's channel and the creator equals the approved identity. | none |

The digest is SHA-256 over the bytes named in the first table. A digest supplied by the gateway is ignored.

A `transaction` or `commit` request that arrives with no recorded proposal for its `tx_id` is refused. A repeated `proposal` request for the recorded proposal is allowed within the grant's signature count.

Existing grants still apply and are checked first: a request with no live grant is refused before any bytes are decoded.

### Decoder

The extension reads the protobuf messages with a strict hand-written reader. It supports varint and length-delimited fields, rejects other wire types, truncated input and a field number that appears twice where the schema allows one, and ignores unknown fields. It decodes the messages named above and nothing else.

### Legacy gateways

`signDigest` is refused unless the selected peer has `legacySigning` set. The flag defaults to off and is shown in the peer's edit form. The flag and the `signDigest` handler are removed together once no gateway in use needs them.

### Popup

The approval popup shows the declared call (channel, chaincode, function, arguments), the signing identity and the peer. The verification guarantees these equal what is signed.

## Options considered

### A. Trust the gateway

Keep the digest protocol and harden the gateway and the grants.

| Dimension | Assessment |
| --- | --- |
| Complexity | Low |
| Extension size | No change |
| Trust required of the gateway | Full: it can obtain a signature over any digest during a grant |
| Public gateways | Not safe |

Rejected: it rules out the stateless public relay.

### B. Move the Fabric client into the extension

The extension builds the proposal and talks to the peer through grpc-web.

| Dimension | Assessment |
| --- | --- |
| Complexity | High |
| Extension size | Large: the client library, grpc-web, protobuf bindings |
| Trust required of the gateway | None |
| Deployment | Every peer needs a grpc-web proxy with CORS in front of it |

Rejected: the proxy requirement moves a deployment cost onto every user, where a gateway is one service.

### C1. Verify bytes, generated protobuf bindings

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium |
| Extension size | About 274 KB minified (37 KB gzipped) for the seven message files needed, 67 KB of it `google-protobuf`. Measured with esbuild for the browser. |
| Duplicate fields | `deserializeBinary` keeps the last duplicate silently, so a separate wire-level pass is still needed |
| Packaging | The web bindings package is unpublished and its tarball omits the generated `*_pb.js` files |
| Other | The bundle contains twelve `Function("return this")` calls. The generated code tries `globalThis`, `window` and `self` first. Not run inside an extension. |

### C2. Verify bytes, hand-written decoder (chosen)

| Dimension | Assessment |
| --- | --- |
| Complexity | Medium: about a hundred lines of reader plus one parser per message |
| Extension size | About 1.2 KB minified for the proposal parser, a few KB for all of it |
| Duplicate fields | Rejected by construction |
| Packaging | None |
| Risk | A field number or wire-type mistake is a defect in this code, with no library behind it |

## Trade-off analysis

C2 over C1 trades convention for size and strictness. The generated parser is the standard route, but it adds more JavaScript than the extension has today and still needs the duplicate-field pass that the hand-written reader provides directly. The field numbers C2 depends on come from the `.proto` files and are pinned by tests that build messages with `@hyperledger/fabric-protos` and decode them with the reader, so a mistake in a field number fails a test. C1 remains available if the set of messages grows beyond what a small reader can carry.

C over A and B trades extension complexity for removing the gateway from the trusted set without requiring a proxy per peer.

## Consequences

**Easier**
- A gateway cannot obtain a signature over a digest unrelated to the approved call. Hosting a public gateway does not ask users to trust the host with signatures.
- The popup can state the call and the signer with the guarantee that they equal what is signed.

**Harder**
- The extension carries a protobuf reader and five message parsers that follow Fabric's schema.
- A gateway must send bytes instead of digests, and the two protocols coexist until `legacySigning` is removed.
- The extension rejects a call it cannot decode, including messages from a future Fabric version that change a field the parser reads.

**Still trusted**
- The gateway sees every request, argument and result and can refuse to relay.
- The extension cannot check the write set and response that peers return, and it signs the endorsed transaction without them. Whether the channel's endorsement policy and validation reject a tampered write set has not been verified.
- The result of an `evaluate` is unsigned and unverified. A client must not present it as verified.

**Open verification**
- Whether `proposal_hash` in the endorsed `ProposalResponsePayload` equals SHA-256 of the channel header, signature header and stripped chaincode proposal payload, and whether `tx_id` equals the hex SHA-256 of nonce and creator. Both would add a cryptographic binding between the proposal and the transaction. Neither is checked until it has been confirmed against a running network.
- The per-method signature counts used by the grants, and the commit of a tampered transaction, against a running network.

## Action items

1. [ ] Hand-written reader and the five parsers, with tests built from `@hyperledger/fabric-protos`.
2. [ ] Verifier: the checks above, with the recorded proposal state.
3. [ ] Gateway: `signRequest` for connections that advertise it, `signDigest` otherwise.
4. [ ] Extension: advertise the capability, route `signRequest` through the verifier, refuse `signDigest` unless the peer sets `legacySigning`.
5. [ ] Popup: declared call, identity and peer.
6. [ ] Run the checks in "Open verification" against a local Fabric network, and add the optional `proposal_hash` and `tx_id` checks if they hold.
7. [ ] Remove `legacySigning` and the `signDigest` handler.

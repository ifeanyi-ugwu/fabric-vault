# Peers

A peer is where the extension sends transactions: a Fabric peer plus the
gateway that reaches it. The user chooses it in the extension. A site cannot
change it silently.

## Read the current peer

```ts
const endpoint = await client.getPeer() // e.g. "peer0.org1.example.com:7051"
```

`onPeerChanged` fires when the user switches peers.

## Ask the user to use a peer

`requestPeer` opens a prompt showing the peer. If the user approves, the peer
is added when it is new, selected, and the call resolves with its name and
endpoint:

```ts
const { name, endpoint } = await client.requestPeer({
  name: "peer0.org1.example.com",
  endpoint: "peer0.org1.example.com:7051",
  rpcUrl: "wss://gateway.example.com",
  tlsRootCert: pem, // optional
})
```

- Call `connect()` first. A site that has not connected cannot ask.
- The user is asked every time, including for a peer they already have, because
  switching changes where their transactions go.
- A site has one request open at a time.
- `rpcUrl` must be `wss://`. `ws://` is accepted only for `localhost`,
  `127.0.0.1` and `[::1]`.
- The prompt tells the user that the gateway sees every transaction sent
  through the peer, with its arguments and results.
- A request cannot turn on legacy signing. That setting exists only in the
  extension's own peer forms.

If the user declines, the promise rejects.

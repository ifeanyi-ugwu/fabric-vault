# Subscriptions

Subscribe to real-time events from the Fabric network. The extension pushes
events to your `onSubscriptionEvent` handler.

## Block events

```ts
const subId = await client.subscribeBlocks({ channel: "mychannel" })

client.onSubscriptionEvent((msg) => {
  console.log("Block event:", msg.data)
})
```

Start from a specific block number:

```ts
const subId = await client.subscribeBlocks({
  channel: "mychannel",
  startBlock: 42,
})
```

## Chaincode events

```ts
const subId = await client.subscribeChaincodeEvents({
  channel: "mychannel",
  chaincode: "basic",
})

client.onSubscriptionEvent((msg) => {
  console.log("Chaincode event:", msg.data)
})
```

## Unsubscribe

```ts
const { success } = await client.unsubscribe(subId)
```

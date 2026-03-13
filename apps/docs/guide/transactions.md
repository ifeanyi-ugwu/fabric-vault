# Transactions

All transaction methods require the user to have previously called `connect()`
so the extension has an authorized identity for your origin.

## Read-only query

`evaluate` simulates a transaction without changing ledger state:

```ts
const result = await client.evaluate({
  channel: "mychannel",
  chaincode: "basic",
  fn: "GetAllAssets",
})
```

## Submit (synchronous)

`submit` sends the transaction and waits until it is committed to the ledger:

```ts
const result = await client.submit({
  channel: "mychannel",
  chaincode: "basic",
  fn: "TransferAsset",
  args: ["asset1", "newOwner"],
})
```

## Submit (asynchronous)

`submitAsync` returns immediately after the orderer accepts the transaction.
Use it when you don't need to wait for ledger commit:

```ts
const { transactionId } = await client.submitAsync({
  channel: "mychannel",
  chaincode: "basic",
  fn: "TransferAsset",
  args: ["asset1", "newOwner"],
})
console.log("Submitted:", transactionId)
```

## Specifying an identity

Pass `identity` in any transaction call to use a specific certificate rather
than the extension's currently selected one:

```ts
await client.submit({
  channel: "mychannel",
  chaincode: "basic",
  fn: "CreateAsset",
  args: ["asset2", "red", "5", "Tom", "100"],
  identity: { mspId: "Org1MSP", certificate: "-----BEGIN CERTIFICATE-----..." },
})
```

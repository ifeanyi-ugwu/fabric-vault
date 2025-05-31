# FabricVault Demo

## FabricVault API Test Demo README

This README explains how to use the provided `test2.html` demo page to test the functionality of your FabricVault browser extension. This demo serves as a practical example of how a web application can interact with the FabricVault API.

### Purpose of this Demo

The `test2.html` file is a simple web page designed to:

- **Demonstrate API Calls:** Showcase various API calls available through the `window.fabric` object provided by the FabricVault extension.
- **Test Connectivity:** Verify that your FabricVault extension is properly configured and connected to your Hyperledger Fabric network and the RPC gateway.
- **Interactive Testing:** Allow you to manually trigger Fabric transactions and event subscriptions.

---

### Prerequisites

Before running this demo, ensure you have:

1. **FabricVault Extension Installed:** The FabricVault browser extension must be installed in your browser.
2. **FabricVault Configured:** The extension should have peers and identities configured.
   - **Crucially, before beginning this demo, you must have:**
     - **Added at least one Peer** in the FabricVault extension's dashboard (under the "Peers" tab). When adding a peer, you'll need to provide its:
       - Name (e.g., `peer0.org1.example.com`)
       - Endpoint (e.g., `localhost:7051`)
       - **RPC URL** (e.g., `ws://localhost:7545` if self-hosting the gateway, or `ws://hyperledger-fabric-json-rpc-gateway.onrender.com` for the public gateway).
       - **TLS CA Certificate** (if the peer uses TLS, which is highly recommended). **Import** the certificate file.
         - _Tip for Fabric Samples users:_ The TLS CA certificate for `peer0.org1.example.com` is typically found at:
           `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt`
     - **Added at least one Identity** in the FabricVault extension's dashboard (under the "Identities" tab). Provide a unique label, its correct `mspId` (e.g., `Org1MSP`), **import** its public certificate, and **paste** its private key.
       - _Tip for Fabric Samples users:_ Your user certificates are typically found at:
         `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/signcerts/User1@org1.example.com-cert.pem`
       - Your private keys are typically found at:
         `fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users/User1@org1.example.com/msp/keystore/<YOUR_PRIVATE_KEY_FILE>` (the filename usually ends with `_sk`).
     - **Selected an active Peer** and **selected an active Identity** within the FabricVault extension's dashboard. While the demo can request specific identities, having an active identity set is good practice and serves as the default if a dApp doesn't specify one.
   - Refer to the main **FabricVault Extension README** for detailed configuration instructions.
   - **Your Hyperledger Fabric network must be running and accessible.**
3. **Fabric Chaincode Deployed:** For the "Specific Transactions" and "Generic Transaction Builder" sections to work, a chaincode (e.g., the `basic` asset transfer chaincode from Fabric Samples) must be deployed on your `mychannel` channel.
   - _The sample chaincode (`basic`) and the `mychannel` are from the standard Hyperledger Fabric test network documentation (`https://hyperledger-fabric.readthedocs.io/en/release-2.5/test_network.html`)._

---

### How to Run the Demo

1. **Save the HTML:** Save the provided HTML code as an `test2.html` file on your local machine.
2. **Serve over HTTP:** For the FabricVault extension to interact securely with the demo page, the `test2.html` file **must be served over HTTP (or HTTPS)**. Simply opening the file directly from your file system (e.g., `file:///path/to/test2.html`) will lead to security restrictions and prevent the extension's API from being accessible.
   - A simple way to serve it is using Python:
     1. Open your terminal or command prompt.
     2. Navigate to the directory where you saved `test2.html`.
     3. Run the command: `python -m http.server 8000`
     - This will start a basic web server on port `8000`.
   - Alternatively, you can use other local web servers (e.g., Node.js `http-server`, Apache, Nginx).
3. **Open in Browser:** Once the server is running, open your web browser (the browser where FabricVault is installed) and navigate to `http://localhost:8000/test2.html` (or the appropriate address if you used a different port or server).
4. **Observe Output:** An "Output & Events" panel will appear at the bottom (or on the right sidebar for larger screens) to display the results of your interactions and any events received from FabricVault.

---

### Demo Page Functionality

The demo page is divided into several sections:

#### 1. Wallet Connection & Identities

- **Connect Wallet:** Clicks this button to trigger the `fabric_requestIdentities` method. This will open a prompt from the FabricVault extension, asking the user to grant permission to this web page to access their stored Fabric identities. Upon approval, the extension will share the _public details_ (label, MSP ID, certificate hash) of the identities with the demo page.
- **Get Identities:** After connecting (or if you've already granted permission), click this to fetch available identities using `fabric_identities`. The **"Select Identity"** dropdown will then be populated with the _public details_ of the identities you have granted access to. **You must select an identity from this dropdown before performing any transactions** on the demo page, as its certificate and MSP ID will be sent with the transaction request parameters to FabricVault for signing.

#### 2. Specific Transactions

These buttons perform pre-defined transactions using the currently selected identity.

- **Evaluate: GetAllAssets:** Calls `fabric_evaluateTransaction` with the `GetAllAssets` function on the `basic` chaincode, using the identity selected in the dropdown.
- **Submit: TransferAsset ('asset6', 'Christopher'):** Calls `fabric_submitTransaction` to transfer 'asset6' to 'Christopher', using the identity selected in the dropdown.

#### 3. Generic Transaction Builder

This section allows you to construct and execute arbitrary `evaluate` or `submit` transactions.

- **Transaction Type:** Choose between `Evaluate Transaction` (read-only) and `Submit Transaction` (writes to the ledger).
- **Channel Name:** Specify the Fabric channel (default: `mychannel`).
- **Chaincode Name:** Specify the chaincode (default: `basic`).
- **Function Name (fn):** Enter the name of the chaincode function to invoke (e.g., `CreateAsset`, `ReadAsset`, `UpdateAsset`).
- **Arguments (args):** Provide comma-separated arguments for the function (e.g., `arg1, arg2, 123`).
- **Execute Generic Transaction:** Executes the constructed transaction using the identity selected in the dropdown.

#### 4. Event Subscriptions

- **Subscribe to Block Events:** Subscribes to new block events on `mychannel` using `fabric_subscribe` with `eventType: "block"`.
- **Subscribe to Chaincode Events:** Subscribes to chaincode events from the `basic` chaincode on `mychannel` using `fabric_subscribe` with `eventType: "chaincode"`.

#### Output & Events Panel

- This panel displays the results of your API calls, including success messages, error details, and any events received from FabricVault (e.g., `connect`, `disconnect`, `identitiesChanged`, `peerChanged`, `fabric_subscription`).
- **Clear Button:** Clears the output panel.

---

### Important Notes

- **Pre-configuration in Extension is Crucial:** For the demo to work, you _must_ have correctly added peers and identities to your FabricVault extension's dashboard and selected an active peer/identity _before_ trying to use the demo page. The demo page relies on the extension to manage and provide these connections and credentials securely.
- **Identity Selection on Demo Page:** The "Select Identity" dropdown on this demo page is populated from the identities _that you have granted access to via the extension's prompt_. You need to choose one from this dropdown for the transaction buttons to know which identity's public certificate and MSP ID to send to the extension for signing.
- **Error Handling:** The demo includes basic error display in the output panel. In a real application, you would implement more robust error handling and user feedback.

---

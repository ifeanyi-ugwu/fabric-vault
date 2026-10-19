import { Signer } from "@hyperledger/fabric-gateway";
import WebSocket from "ws";
import { FabricService, RequestSigner, Signing } from "./fabric.service";

interface EventSubscription {
  closeListener: () => void;
  service: FabricService; // Keep reference for cleanup
}

// Bounds how long a call waits on the client's signature; without it a client
// that stops answering holds the call, its listeners and its gRPC stream open.
const DEFAULT_SIGNATURE_TIMEOUT_MS =
  Number(process.env.GATEWAY_SIGNATURE_TIMEOUT_MS) || 30 * 1000;

export interface HandlerOptions {
  /** Replaces how a Fabric service is built; tests supply a stub. */
  createService?: typeof FabricService.createForUser;
  signatureTimeoutMs?: number;
  maxBatchSize?: number;
  maxConcurrentRequests?: number;
  maxSubscriptions?: number;
}

export class JsonRpcHandler {
  private subscriptions: Record<string, EventSubscription> = {};
  private fabricService: FabricService | null = null;

  private inFlight = 0;
  private createService: typeof FabricService.createForUser;
  // Fixed by the first request: a client cannot switch protocols mid-connection.
  private signRequestSupported: boolean | null = null;
  private signatureTimeoutMs: number;
  private maxBatchSize: number;
  private maxConcurrentRequests: number;
  private maxSubscriptions: number;

  constructor(private ws: WebSocket, options: HandlerOptions = {}) {
    this.createService =
      options.createService ?? FabricService.createForUser.bind(FabricService);
    this.signatureTimeoutMs =
      options.signatureTimeoutMs ?? DEFAULT_SIGNATURE_TIMEOUT_MS;
    this.maxBatchSize = options.maxBatchSize ?? Infinity;
    this.maxConcurrentRequests = options.maxConcurrentRequests ?? Infinity;
    this.maxSubscriptions = options.maxSubscriptions ?? Infinity;
  }

  // Send JSON-RPC response
  private sendResponse(id: string, result: any): void {
    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        result,
        id,
      })
    );
  }

  // Send JSON-RPC error
  private sendError(
    id: string | null,
    code: number,
    message: string,
    data?: any
  ): void {
    this.ws.send(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code,
          message,
          data: data
            ? {
                message: data.message,
                stack:
                  process.env.NODE_ENV === "development"
                    ? data.stack
                    : undefined,
              }
            : undefined,
        },
        id,
      })
    );
  }

  // Send notifications (no id)
  private sendNotification(method: string, params: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method,
          params,
        })
      );
    }
  }

  // Process the raw incoming message — supports batch and single requests
  async processMessage(msgData: string): Promise<void> {
    let parsed: any;
    try {
      parsed = JSON.parse(msgData);
    } catch {
      this.sendError(null, -32700, "Parse error: Invalid JSON");
      return;
    }

    const requestCount = Array.isArray(parsed) ? parsed.length : 1;
    if (requestCount > this.maxBatchSize) {
      this.sendError(null, -32600, "Invalid Request: Batch too large");
      return;
    }
    if (this.inFlight + requestCount > this.maxConcurrentRequests) {
      this.sendError(null, -32005, "Too many concurrent requests");
      return;
    }
    this.inFlight += requestCount;
    try {
      await this.processParsed(parsed);
    } finally {
      this.inFlight -= requestCount;
    }
  }

  private async processParsed(parsed: any): Promise<void> {
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) {
        this.sendError(null, -32600, "Invalid Request: Empty batch");
        return;
      }
      // Process all concurrently
      const promises = parsed.map(async (req) => {
        try {
          return await this.processSingleRequest(req);
        } catch (err) {
          console.error("Batch request error:", err);
          return this.buildError(
            req.id || null,
            -32000,
            "Batch item failed",
            err as Error
          );
        }
      });

      const responses = (await Promise.all(promises)).filter((r) => r !== null); // filter notifications
      if (responses.length > 0) {
        this.ws.send(JSON.stringify(responses));
      }
    } else {
      // Single request
      try {
        const res = await this.processSingleRequest(parsed);
        if (res) {
          this.ws.send(JSON.stringify(res));
        }
      } catch (err) {
        console.error("Request processing error:", err);
        this.sendError(
          parsed.id || null,
          -32000,
          "Internal error",
          err as Error
        );
      }
    }
  }

  // Process an individual JSON-RPC request object — returns response or null (notification)
  private async processSingleRequest(msg: any): Promise<any | null> {
    if (
      msg.jsonrpc !== "2.0" ||
      (msg.method && typeof msg.method !== "string")
    ) {
      return this.buildError(msg.id || null, -32600, "Invalid Request");
    }
    if (msg.method) {
      // Handle call
      return await this.runHandlerWithErrorHandling(msg);
    } else if ("result" in msg || "error" in msg) {
      // Response message — ignore for now
      return null;
    } else {
      return this.buildError(msg.id || null, -32600, "Invalid Request");
    }
  }

  // Wraps dispatch handler call with validation and centralized error catching
  private async runHandlerWithErrorHandling(msg: any): Promise<any> {
    const { id, method, params } = msg;
    try {
      // Validate params or throw error
      this.validateRequiredParams(params);
      this.noteCapabilities(params);

      // Initialize fabricService lazily if not already created
      if (!this.fabricService) {
        const { identity, peer } = params || {};
        if (!identity || !peer) {
          throw this.buildError(
            id,
            -32602,
            "Missing identity or peer details to initialize Fabric service."
          );
        }
        const fabricIdentity = {
          mspId: identity.mspId,
          credentials: new Uint8Array(Buffer.from(identity.certificate)),
        };
        this.fabricService = await this.createService(
          fabricIdentity,
          this.signing(identity.certificate),
          {
            name: peer.name,
            endpoint: peer.endpoint,
            tlsRootCert: peer.tlsRootCert,
          }
        );
      }

      // Dispatch to specific handler
      return await this.dispatchHandler(method, params, id);
    } catch (err: any) {
      // If error is already a JSON-RPC error format, just return it
      if (err && typeof err === "object" && "jsonrpc" in err) {
        return err;
      }
      // Otherwise build error response
      return this.buildError(id, -32000, `Error handling ${method}`, err);
    }
  }

  // Validate required parameters or throw error
  private validateRequiredParams(params: any): void {
    if (!params || typeof params !== "object") {
      throw this.buildError(null, -32602, "Invalid params", {
        message: "Params must be an object.",
      });
    }
    // You can add more global validations here if needed
  }

  // Dispatch method to handler
  private async dispatchHandler(
    method: string,
    params: any,
    id: string
  ): Promise<any> {
    switch (method) {
      case "fabric_evaluateTransaction":
        return await this.handleEvaluateTransaction(id, params);
      case "fabric_submitTransaction":
        return await this.handleSubmitTransaction(id, params);
      case "fabric_submitAsync":
        return await this.handleSubmitAsync(id, params);
      case "fabric_subscribe":
        return await this.handleSubscribe(id, params);
      case "fabric_unsubscribe":
        return await this.handleUnsubscribe(id, params);
      default:
        return this.buildError(id, -32601, "Method not found");
    }
  }

  cleanup(): void {
    Object.keys(this.subscriptions).forEach((subId) => {
      try {
        this.subscriptions[subId].closeListener();
        this.subscriptions[subId].service.close();
        delete this.subscriptions[subId];
      } catch (err) {
        console.error(`Error cleaning up subscription ${subId}:`, err);
      }
    });
  }

  /** Signs digests: the protocol for clients that do not advertise `signRequest`. */
  createSigner(certificate: string): Signer {
    return (digest: Uint8Array): Promise<Uint8Array> =>
      this.requestSignature(
        "signDigest",
        { digest: Buffer.from(digest).toString("base64") },
        certificate
      );
  }

  /** Signs serialized requests, so the client can check what it signs. */
  createRequestSigner(certificate: string): RequestSigner {
    return (kind, bytes) =>
      this.requestSignature(
        "signRequest",
        { kind, bytes: Buffer.from(bytes).toString("base64") },
        certificate
      );
  }

  private signing(certificate: string): Signing {
    return this.signRequestSupported
      ? { request: this.createRequestSigner(certificate) }
      : { digest: this.createSigner(certificate) };
  }

  private noteCapabilities(params: any): void {
    if (this.signRequestSupported !== null) return;
    this.signRequestSupported =
      Array.isArray(params?.capabilities) &&
      params.capabilities.includes("signRequest");
  }

  private async createFabricService(
    identity: any,
    peer: any
  ): Promise<FabricService> {
    if (
      !identity?.certificate ||
      !identity?.mspId ||
      !peer?.name ||
      !peer?.endpoint
    ) {
      throw new Error("Missing required identity or peer details");
    }

    const fabricIdentity = {
      mspId: identity.mspId,
      credentials: new Uint8Array(Buffer.from(identity.certificate)),
    };
    return await this.createService(
      fabricIdentity,
      this.signing(identity.certificate),
      {
        name: peer.name,
        endpoint: peer.endpoint,
        tlsRootCert: peer.tlsRootCert,
      }
    );
  }

  /**
   * Requests a signature via WebSocket. Every exit path removes its listeners:
   * a reply, an error reply, a closed socket, or the timeout.
   */
  private requestSignature(
    method: "signDigest" | "signRequest",
    material: Record<string, string>,
    certificate: string
  ): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const requestId = generateUniqueId();

      const finish = () => {
        clearTimeout(timer);
        this.ws.off("message", onMessage);
        this.ws.off("close", onClose);
      };
      const onMessage = (rawMsg: WebSocket.RawData) => {
        let reply: any;
        try {
          reply = JSON.parse(rawMsg.toString());
        } catch {
          return; // not ours; other traffic shares this socket
        }
        if (reply?.jsonrpc !== "2.0" || reply.id !== requestId) return;
        finish();
        if (reply.result?.signature) {
          resolve(
            Uint8Array.from(Buffer.from(reply.result.signature, "base64"))
          );
        } else {
          reject(new Error(reply.error?.message ?? "Signature request failed"));
        }
      };
      const onClose = () => {
        finish();
        reject(new Error("Connection closed before a signature was returned"));
      };
      const timer = setTimeout(() => {
        finish();
        reject(
          new Error(
            `Signature request timed out after ${this.signatureTimeoutMs}ms`
          )
        );
      }, this.signatureTimeoutMs);

      this.ws.on("message", onMessage);
      this.ws.on("close", onClose);
      try {
        this.ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            method,
            params: { ...material, certificate },
            id: requestId,
          })
        );
      } catch (err) {
        finish();
        reject(err);
      }
    });
  }

  // === Handlers ===

  private async handleEvaluateTransaction(id: string, params: any) {
    this.ensureFabricService();
    this.ensureCorrectParams(id, params, [
      "identity",
      "channel",
      "chaincode",
      "fn",
      "peer",
    ]);

    const { identity, channel, chaincode, fn, args, peer } = params;
    this.validateRequiredParamsArray(id, [
      identity?.certificate,
      identity?.mspId,
      channel,
      chaincode,
      fn,
      peer?.name,
      peer?.endpoint,
    ]);

    try {
      const service = await this.createFabricService(identity, peer);
      const chaincodeName =
        typeof chaincode === "string" ? chaincode : chaincode.name;
      const contractName =
        typeof chaincode === "object" ? chaincode.contract : undefined;
      const result = await service.evaluateTransaction({
        channelName: channel,
        chaincodeName,
        contractName,
        fn,
        args,
      });
      service.close();
      return result;
    } catch (err) {
      throw err;
    }
  }

  private async handleSubmitTransaction(id: string, params: any) {
    this.ensureFabricService();
    this.ensureCorrectParams(id, params, [
      "identity",
      "channel",
      "chaincode",
      "fn",
      "peer",
    ]);

    const { identity, channel, chaincode, fn, args, peer } = params;
    this.validateRequiredParamsArray(id, [
      identity?.certificate,
      identity?.mspId,
      channel,
      chaincode,
      fn,
      peer?.name,
      peer?.endpoint,
    ]);

    try {
      const service = await this.createFabricService(identity, peer);
      const chaincodeName =
        typeof chaincode === "string" ? chaincode : chaincode.name;
      const contractName =
        typeof chaincode === "object" ? chaincode.contract : undefined;
      const result = await service.submitTransaction({
        channelName: channel,
        chaincodeName,
        contractName,
        fn,
        args,
      });
      service.close();
      return result;
    } catch (err) {
      throw err;
    }
  }

  private async handleSubmitAsync(id: string, params: any) {
    this.ensureFabricService();
    this.ensureCorrectParams(id, params, [
      "identity",
      "channel",
      "chaincode",
      "fn",
      "peer",
    ]);

    const { identity, channel, chaincode, fn, args, peer } = params;
    this.validateRequiredParamsArray(id, [
      identity?.certificate,
      identity?.mspId,
      channel,
      chaincode,
      fn,
      peer?.name,
      peer?.endpoint,
    ]);

    try {
      const service = await this.createFabricService(identity, peer);
      const chaincodeName =
        typeof chaincode === "string" ? chaincode : chaincode.name;
      const contractName =
        typeof chaincode === "object" ? chaincode.contract : undefined;
      const transactionId = await service.submitAsync({
        channelName: channel,
        chaincodeName,
        contractName,
        fn,
        args,
      });
      service.close();
      return { transactionId };
    } catch (err) {
      throw err;
    }
  }

  async handleSubscribe(id: string, params: any) {
    this.ensureCorrectParams(id, params, ["eventType"]);

    if (Object.keys(this.subscriptions).length >= this.maxSubscriptions) {
      return this.buildError(id, -32005, "Too many subscriptions");
    }

    const { eventType } = params;
    if (eventType !== "chaincode" && eventType !== "block") {
      return this.buildError(id, -32602, "Invalid params", {
        message: `Invalid eventType: ${eventType}. Supported types are 'chaincode' and 'block'.`,
      });
    }

    if (eventType === "chaincode") {
      return await this.handleSubscribeChaincodeEvents(id, params);
    } else {
      return await this.handleSubscribeBlockEvents(id, params);
    }
  }

  private async handleSubscribeChaincodeEvents(id: string, params: any) {
    this.ensureFabricService();
    this.ensureCorrectParams(id, params, [
      "identity",
      "channel",
      "chaincode",
      "peer",
    ]);

    const { identity, channel, chaincode, peer } = params;
    this.validateRequiredParamsArray(id, [
      identity?.certificate,
      identity?.mspId,
      channel,
      chaincode,
      peer?.name,
      peer?.endpoint,
    ]);

    try {
      const service = await this.createFabricService(identity, peer);
      const chaincodeName =
        typeof chaincode === "string" ? chaincode : chaincode.name;
      const eventsIterator = await service.subscribeToChaincodeEvents(
        channel,
        chaincodeName
      );
      const subscriptionId = generateUniqueId();

      const eventProcessor = async () => {
        try {
          for await (const event of eventsIterator) {
            this.sendNotification("fabric_subscription", {
              subscription: subscriptionId,
              result: {
                chaincodeName: event.chaincodeName,
                blockNumber: event.blockNumber.toString(),
                transactionId: event.transactionId,
                eventName: event.eventName,
                payload: Buffer.from(event.payload).toString("base64"),
              },
            });
          }
        } catch (err) {
          console.error("Chaincode event processing error:", err);
          this.sendNotification("fabric_subscription", {
            subscription: subscriptionId,
            result: { error: { message: "Event stream closed due to error" } },
          });
          this.cleanupSubscription(subscriptionId);
        } finally {
          this.cleanupSubscription(subscriptionId);
        }
      };

      eventProcessor();

      this.subscriptions[subscriptionId] = {
        closeListener: () => eventsIterator.close(),
        service,
      };

      return subscriptionId;
    } catch (err) {
      throw err;
    }
  }

  private async handleSubscribeBlockEvents(id: string, params: any) {
    this.ensureFabricService();
    this.ensureCorrectParams(id, params, ["identity", "channel", "peer"]);

    const { identity, channel, startBlock, peer } = params;
    this.validateRequiredParamsArray(id, [
      identity?.certificate,
      identity?.mspId,
      channel,
      peer?.name,
      peer?.endpoint,
    ]);

    try {
      const service = await this.createFabricService(identity, peer);
      const options = startBlock ? { startBlock: BigInt(startBlock) } : {};
      const eventsIterator = await service.subscribeToBlockEvents(
        channel,
        options
      );
      const subscriptionId = generateUniqueId();

      const eventProcessor = async () => {
        try {
          for await (const block of eventsIterator) {
            const blockAsObject = block.toObject();
            const encodedBlock = encodeUint8ArraysToBase64(blockAsObject);
            this.sendNotification("fabric_subscription", {
              subscription: subscriptionId,
              result: { block: encodedBlock },
            });
          }
        } catch (err) {
          console.error("Block event processing error:", err);
          this.sendNotification("fabric_subscription", {
            subscription: subscriptionId,
            result: { error: { message: "Event stream closed due to error" } },
          });
          this.cleanupSubscription(subscriptionId);
        } finally {
          this.cleanupSubscription(subscriptionId);
        }
      };

      eventProcessor();

      this.subscriptions[subscriptionId] = {
        closeListener: () => eventsIterator.close(),
        service,
      };

      return subscriptionId;
    } catch (err) {
      throw err;
    }
  }

  private cleanupSubscription(subscriptionId: string): void {
    if (this.subscriptions[subscriptionId]) {
      try {
        this.subscriptions[subscriptionId].closeListener();
        this.subscriptions[subscriptionId].service.close();
        delete this.subscriptions[subscriptionId];
      } catch (err) {
        console.error(`Error cleaning up subscription ${subscriptionId}:`, err);
      }
    }
  }

  private async handleUnsubscribe(id: string, params: any) {
    this.ensureCorrectParams(id, params, ["subscriptionId"]);

    const { subscriptionId } = params;
    if (!this.subscriptions[subscriptionId]) {
      return this.buildError(id, -32602, "Invalid params", {
        message: `Invalid subscriptionId: ${subscriptionId}`,
      });
    }
    this.cleanupSubscription(subscriptionId);
    return true;
  }

  private ensureFabricService() {
    if (!this.fabricService) {
      throw this.buildError(null, -32000, "Fabric service not initialized.");
    }
  }

  private ensureCorrectParams(id: string, params: any, requiredKeys: string[]) {
    if (!params || typeof params !== "object") {
      throw this.buildError(id, -32602, "Invalid params", {
        message: "Params must be an object.",
      });
    }
    for (const key of requiredKeys) {
      if (params[key] === undefined || params[key] === null) {
        throw this.buildError(id, -32602, "Invalid params", {
          message: `Missing required parameter: ${key}`,
        });
      }
    }
  }

  private validateRequiredParamsArray(id: string, params: any[]) {
    if (params.some((p) => p === undefined || p === null)) {
      throw this.buildError(id, -32602, "Invalid params", {
        message: "Missing required fields",
      });
    }
  }

  // Helpers to build JSON-RPC response and error objects
  private buildResponse(id: string, result: any) {
    return { jsonrpc: "2.0", result, id };
  }

  private buildError(
    id: string | null,
    code: number,
    message: string,
    data?: any
  ) {
    return {
      jsonrpc: "2.0",
      error: {
        code,
        message,
        data: data
          ? {
              message: data.message,
              stack:
                process.env.NODE_ENV === "development" ? data.stack : undefined,
            }
          : undefined,
      },
      id,
    };
  }
}

function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function encodeUint8ArraysToBase64(obj: any): any {
  if (obj instanceof Uint8Array) {
    return Buffer.from(obj).toString("base64");
  } else if (typeof obj === "object" && obj !== null) {
    const newObj: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = encodeUint8ArraysToBase64(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

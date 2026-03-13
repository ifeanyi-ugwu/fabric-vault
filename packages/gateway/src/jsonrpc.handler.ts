import { Signer } from "@hyperledger/fabric-gateway";
import WebSocket from "ws";
import { FabricService } from "./fabric.service";

interface EventSubscription {
  closeListener: () => void;
  service: FabricService; // Keep reference for cleanup
}

export class JsonRpcHandler {
  private subscriptions: Record<string, EventSubscription> = {};
  private fabricService: FabricService | null = null;

  constructor(private ws: WebSocket) {}

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
          credentials: Buffer.from(identity.certificate),
        };
        const signer = this.createSigner(identity.certificate);
        this.fabricService = await FabricService.createForUser(
          fabricIdentity,
          signer,
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

  createSigner(certificate: string): Signer {
    return async (digest: Uint8Array): Promise<Uint8Array> => {
      const signature = await this.requestSignature(digest, certificate);
      if (!signature) {
        throw new Error("Signature not received");
      }
      return signature;
    };
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
      credentials: Buffer.from(identity.certificate),
    };
    const signer = this.createSigner(identity.certificate);

    return await FabricService.createForUser(fabricIdentity, signer, {
      name: peer.name,
      endpoint: peer.endpoint,
      tlsRootCert: peer.tlsRootCert,
    });
  }

  /**
   * Requests a signature via WebSocket
   */
  private async requestSignature(
    digest: Uint8Array,
    certificate: string
  ): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const requestId = generateUniqueId();
      const handler = (rawMsg: WebSocket.RawData) => {
        try {
          const reply = JSON.parse(rawMsg.toString());
          if (
            reply.jsonrpc === "2.0" &&
            reply.id === requestId &&
            reply.result?.signature
          ) {
            this.ws.off("message", handler);
            resolve(
              Uint8Array.from(Buffer.from(reply.result.signature, "base64"))
            );
          }
        } catch {
          this.ws.off("message", handler);
          resolve(null);
        }
      };
      this.ws.on("message", handler);
      this.ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "signDigest",
          params: {
            digest: Buffer.from(digest).toString("base64"),
            certificate,
          },
          id: requestId,
        })
      );
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

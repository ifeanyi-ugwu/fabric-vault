import type { ProviderRpcErrorCode } from "@fabric-vault/types"

export class FabricRpcError extends Error {
  constructor(
    message: string,
    readonly code: ProviderRpcErrorCode,
    readonly data?: unknown
  ) {
    super(message)
    this.name = "FabricRpcError"
  }
}

export class ProviderNotFoundError extends Error {
  constructor() {
    super(
      "No Fabric Vault provider was found. Is the extension installed and unlocked?"
    )
    this.name = "ProviderNotFoundError"
  }
}

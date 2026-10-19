import { Client, credentials } from "@grpc/grpc-js";
import { LRUCache } from "lru-cache";
import { resolvePeerEndpoint } from "./peer-endpoint";

const grpcClientCache = new LRUCache<string, Client>({
  max: 10,
  ttl: 30 * 60 * 1000, //  30 minutes,
  dispose: (client) => client.close(),
});

/**
 * Private, loopback and link-local peers are refused by default so a public
 * gateway cannot be pointed at its own network. A gateway run next to a local
 * Fabric network sets GATEWAY_ALLOW_PRIVATE_PEERS=true.
 */
function allowPrivatePeers(): boolean {
  return process.env.GATEWAY_ALLOW_PRIVATE_PEERS === "true";
}

/**
 * the tlsRootCert should be a valid PEM string
 */
export async function getOrCreateGrpcClient({
  peerEndpoint,
  peerName,
  tlsRootCert,
}: {
  peerEndpoint: string;
  peerName: string;
  tlsRootCert?: string;
}) {
  const cacheKey = `${peerEndpoint}-${peerName}-${tlsRootCert}`;
  const cachedClient = grpcClientCache.get(cacheKey);

  if (cachedClient) {
    return cachedClient;
  }

  // Dialing the validated address instead of the name keeps a later DNS
  // change from redirecting an already-checked connection.
  const { target, authority } = await resolvePeerEndpoint(peerEndpoint, {
    allowPrivate: allowPrivatePeers(),
  });

  const tlsCredentials = credentials.createSsl(
    tlsRootCert ? Buffer.from(tlsRootCert) : undefined
  );
  const newClient = new Client(target, tlsCredentials, {
    "grpc.ssl_target_name_override": peerName,
    "grpc.default_authority": authority,
  });

  grpcClientCache.set(cacheKey, newClient);

  return newClient;
}

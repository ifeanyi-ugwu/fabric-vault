import { promises as dns } from "node:dns";
import { BlockList, isIP } from "node:net";

export class PeerEndpointError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeerEndpointError";
  }
}

export type Lookup = (
  host: string
) => Promise<ReadonlyArray<{ address: string; family: number }>>;

export interface ResolvedPeerEndpoint {
  /** Validated address and port, safe to hand to the gRPC client. */
  target: string;
  /** The hostname the caller supplied, kept for the :authority header. */
  authority: string;
}

const nonPublic = new BlockList();

const IPV4_NON_PUBLIC: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

const IPV6_NON_PUBLIC: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];

for (const [net, prefix] of IPV4_NON_PUBLIC) nonPublic.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of IPV6_NON_PUBLIC) nonPublic.addSubnet(net, prefix, "ipv6");

const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/**
 * False for loopback, private, link-local (including the cloud metadata
 * address), carrier-grade NAT, multicast, documentation and other reserved
 * ranges. An IPv4-mapped IPv6 address is judged by the IPv4 address it wraps.
 */
export function isPublicAddress(address: string): boolean {
  const mapped = MAPPED_V4.exec(address);
  const candidate = mapped ? mapped[1] : address;
  const family = isIP(candidate);
  if (family === 0) return false;
  return !nonPublic.check(candidate, family === 4 ? "ipv4" : "ipv6");
}

const HOSTNAME_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;

/**
 * Accepts only `host:port` and `[ipv6]:port`. gRPC target syntax also allows
 * schemes (`dns:///`, `unix:`), which would route around the address check.
 */
export function parseEndpoint(endpoint: unknown): { host: string; port: number } {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 300) {
    throw new PeerEndpointError("Peer endpoint must be a host:port string.");
  }

  let host: string;
  let portText: string;
  const bracketed = /^\[([0-9a-f:.]+)\]:(\d+)$/i.exec(endpoint);
  if (bracketed) {
    [, host, portText] = bracketed;
    if (isIP(host) !== 6) {
      throw new PeerEndpointError("Peer endpoint has an invalid IPv6 address.");
    }
  } else {
    const separator = endpoint.lastIndexOf(":");
    if (separator <= 0) {
      throw new PeerEndpointError("Peer endpoint must be a host:port string.");
    }
    host = endpoint.slice(0, separator);
    portText = endpoint.slice(separator + 1);
    const isHostname =
      host.length <= 253 &&
      host.split(".").every((label) => HOSTNAME_LABEL.test(label));
    if (!isHostname && isIP(host) !== 4) {
      throw new PeerEndpointError("Peer endpoint has an invalid host.");
    }
  }

  if (!/^\d{1,5}$/.test(portText)) {
    throw new PeerEndpointError("Peer endpoint has an invalid port.");
  }
  const port = Number(portText);
  if (port < 1 || port > 65535) {
    throw new PeerEndpointError("Peer endpoint has an invalid port.");
  }
  return { host, port };
}

const systemLookup: Lookup = (host) =>
  dns.lookup(host, { all: true, verbatim: true });

/**
 * Validates a client-supplied peer endpoint and returns the address to dial.
 * The gateway connects to the resolved address rather than the hostname, so a
 * DNS answer that changes after this check cannot redirect the connection.
 */
export async function resolvePeerEndpoint(
  endpoint: unknown,
  options: { allowPrivate?: boolean; lookup?: Lookup } = {}
): Promise<ResolvedPeerEndpoint> {
  const { allowPrivate = false, lookup = systemLookup } = options;
  const { host, port } = parseEndpoint(endpoint);

  let addresses: ReadonlyArray<{ address: string; family: number }>;
  try {
    addresses = await lookup(host);
  } catch {
    throw new PeerEndpointError(`Peer host ${host} could not be resolved.`);
  }
  if (addresses.length === 0) {
    throw new PeerEndpointError(`Peer host ${host} could not be resolved.`);
  }

  // One non-public answer rejects the host: an attacker-controlled name can
  // publish a public address next to an internal one.
  if (!allowPrivate && !addresses.every(({ address }) => isPublicAddress(address))) {
    throw new PeerEndpointError(
      `Peer host ${host} resolves to a non-public address.`
    );
  }

  const { address, family } = addresses[0];
  return {
    target: family === 6 ? `[${address}]:${port}` : `${address}:${port}`,
    authority: `${host}:${port}`,
  };
}

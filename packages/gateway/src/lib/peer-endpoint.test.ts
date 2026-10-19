import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPublicAddress,
  Lookup,
  parseEndpoint,
  PeerEndpointError,
  resolvePeerEndpoint,
} from "./peer-endpoint";

const answers =
  (...addresses: string[]): Lookup =>
  async () =>
    addresses.map((address) => ({
      address,
      family: address.includes(":") ? 6 : 4,
    }));

describe("isPublicAddress", () => {
  const nonPublic = [
    "0.0.0.0",
    "10.0.0.0",
    "10.255.255.255",
    "100.64.0.1",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254",
    "172.16.0.0",
    "172.31.255.255",
    "192.168.1.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "ff02::1",
    "64:ff9b::7f00:1",
    "::ffff:127.0.0.1",
    "::ffff:10.0.0.1",
    "::ffff:169.254.169.254",
  ];
  const publicAddresses = [
    "8.8.8.8",
    "1.1.1.1",
    "11.0.0.0",
    "100.63.255.255",
    "100.128.0.0",
    "172.15.255.255",
    "172.32.0.0",
    "169.253.255.255",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ];

  for (const address of nonPublic) {
    it(`rejects ${address}`, () => {
      assert.equal(isPublicAddress(address), false, address);
    });
  }
  for (const address of publicAddresses) {
    it(`accepts ${address}`, () => {
      assert.equal(isPublicAddress(address), true, address);
    });
  }
  it("rejects a string that is not an address", () => {
    assert.equal(isPublicAddress("example.com"), false);
  });
});

describe("parseEndpoint", () => {
  it("parses host:port", () => {
    assert.deepEqual(parseEndpoint("peer0.org1.example.com:7051"), {
      host: "peer0.org1.example.com",
      port: 7051,
    });
  });
  it("parses an IPv4 literal", () => {
    assert.deepEqual(parseEndpoint("203.0.114.9:443"), {
      host: "203.0.114.9",
      port: 443,
    });
  });
  it("parses a bracketed IPv6 literal", () => {
    assert.deepEqual(parseEndpoint("[2606:4700:4700::1111]:7051"), {
      host: "2606:4700:4700::1111",
      port: 7051,
    });
  });

  const rejected: Array<[string, unknown]> = [
    ["a scheme-qualified gRPC target", "dns:///peer.example.com:7051"],
    ["a unix socket target", "unix:/var/run/docker.sock"],
    ["a URL", "http://peer.example.com:7051"],
    ["a missing port", "peer.example.com"],
    ["port zero", "peer.example.com:0"],
    ["a port above 65535", "peer.example.com:65536"],
    ["a non-numeric port", "peer.example.com:abc"],
    ["an empty host", ":7051"],
    ["whitespace in the host", "peer example.com:7051"],
    ["a label starting with a hyphen", "-bad.example.com:7051"],
    ["a malformed IPv6 literal", "[zzzz]:7051"],
    ["a non-string", 7051],
    ["undefined", undefined],
  ];
  for (const [name, input] of rejected) {
    it(`rejects ${name}`, () => {
      assert.throws(() => parseEndpoint(input), PeerEndpointError);
    });
  }
});

describe("resolvePeerEndpoint", () => {
  it("dials the resolved address, not the hostname", async () => {
    const resolved = await resolvePeerEndpoint("peer.example.com:7051", {
      lookup: answers("93.184.216.34"),
    });
    assert.deepEqual(resolved, {
      target: "93.184.216.34:7051",
      authority: "peer.example.com:7051",
    });
  });

  it("brackets an IPv6 target", async () => {
    const resolved = await resolvePeerEndpoint("peer.example.com:7051", {
      lookup: answers("2606:4700:4700::1111"),
    });
    assert.equal(resolved.target, "[2606:4700:4700::1111]:7051");
  });

  it("rejects a host that resolves to a private address", async () => {
    await assert.rejects(
      resolvePeerEndpoint("internal.example.com:7051", {
        lookup: answers("10.1.2.3"),
      }),
      PeerEndpointError
    );
  });

  it("rejects the cloud metadata address", async () => {
    await assert.rejects(
      resolvePeerEndpoint("169.254.169.254:80", {
        lookup: answers("169.254.169.254"),
      }),
      PeerEndpointError
    );
  });

  it("rejects when any answer is non-public", async () => {
    await assert.rejects(
      resolvePeerEndpoint("mixed.example.com:7051", {
        lookup: answers("93.184.216.34", "127.0.0.1"),
      }),
      PeerEndpointError
    );
  });

  it("allows a private address when the operator opts in", async () => {
    const resolved = await resolvePeerEndpoint("peer.local:7051", {
      allowPrivate: true,
      lookup: answers("10.1.2.3"),
    });
    assert.equal(resolved.target, "10.1.2.3:7051");
  });

  it("rejects a host that does not resolve", async () => {
    await assert.rejects(
      resolvePeerEndpoint("nope.example.com:7051", {
        lookup: async () => {
          throw new Error("ENOTFOUND");
        },
      }),
      PeerEndpointError
    );
  });

  it("rejects a host with an empty answer", async () => {
    await assert.rejects(
      resolvePeerEndpoint("empty.example.com:7051", { lookup: answers() }),
      PeerEndpointError
    );
  });

  // These two go through the system resolver, which answers from the hosts
  // file and numeric parsing without touching the network.
  it("rejects localhost", async () => {
    await assert.rejects(resolvePeerEndpoint("localhost:7051"), PeerEndpointError);
  });

  it("rejects a decimal-encoded loopback address", async () => {
    await assert.rejects(resolvePeerEndpoint("2130706433:7051"), PeerEndpointError);
  });
});

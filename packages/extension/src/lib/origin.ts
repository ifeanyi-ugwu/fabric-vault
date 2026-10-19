import type Browser from "webextension-polyfill"

/**
 * The origin of the page behind a port. MessageSender.origin is missing from
 * webextension-polyfill's types and is not guaranteed on Firefox, while
 * sender.url is present in both browsers.
 */
export function getPortOrigin(
  port: Pick<Browser.Runtime.Port, "sender">
): string | undefined {
  const url = port.sender?.url
  if (!url) return undefined
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

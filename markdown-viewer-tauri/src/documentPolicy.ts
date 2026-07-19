export type DocumentType = "markdown" | "html";
export type FileNodeType = "directory" | DocumentType | "image";

export type OpenDocumentResponse =
  | { documentType: "markdown"; sourceText: string; previewUrl: null }
  | { documentType: "html"; sourceText: null; previewUrl: string };

export type HtmlBridgeMessage =
  | { channel: "markdown-viewer-html"; type: "ready" }
  | { channel: "markdown-viewer-html"; type: "openExternal"; href: string };

export type HtmlBridgeAction =
  | { type: "ready" }
  | { type: "openExternal"; href: string };

export type HtmlBridgeContext = {
  sourceMatches: boolean;
  origin: string;
  tabMatches: boolean;
  revisionMatches: boolean;
  readyAccepted: boolean;
  hasTransientUserActivation: boolean;
  duplicateExternalOpen: boolean;
};

export type HtmlBridgeDecision =
  | { accepted: true; action: HtmlBridgeAction }
  | { accepted: false; reason: string };

export const htmlReadyTimeoutMs = 5_000;

export function parseOpenDocumentResponse(value: unknown): OpenDocumentResponse {
  if (!isPlainRecord(value)) {
    throw new Error("The document response is not an object.");
  }

  if (
    value.documentType === "markdown" &&
    typeof value.sourceText === "string" &&
    value.previewUrl === null
  ) {
    return {
      documentType: "markdown",
      sourceText: value.sourceText,
      previewUrl: null,
    };
  }

  if (
    value.documentType === "html" &&
    value.sourceText === null &&
    typeof value.previewUrl === "string" &&
    isHtmlPreviewUrl(value.previewUrl)
  ) {
    return {
      documentType: "html",
      sourceText: null,
      previewUrl: value.previewUrl,
    };
  }

  throw new Error("The document response violates the Markdown/HTML content contract.");
}

export function withPreviewRevision(previewUrl: string, revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 1 || !isHtmlPreviewUrl(previewUrl)) {
    throw new Error("Cannot create an HTML preview URL from invalid input.");
  }
  const url = new URL(previewUrl);
  url.searchParams.set("revision", String(revision));
  return url.toString();
}

export function evaluateHtmlBridgeMessage(
  data: unknown,
  context: HtmlBridgeContext,
): HtmlBridgeDecision {
  if (!context.sourceMatches) {
    return rejected("Message source does not match the active HTML frame.");
  }
  if (context.origin !== "null") {
    return rejected("Message origin is not the sandbox opaque origin.");
  }
  if (!context.tabMatches || !context.revisionMatches) {
    return rejected("Message belongs to a stale HTML tab revision.");
  }

  const message = parseHtmlBridgeMessage(data);
  if (!message) {
    return rejected("Message shape is not part of the HTML bridge contract.");
  }
  if (message.type === "ready") {
    return context.readyAccepted
      ? rejected("Duplicate HTML ready message was ignored.")
      : { accepted: true, action: { type: "ready" } };
  }
  if (!context.readyAccepted) {
    return rejected("External link message arrived before the HTML frame was ready.");
  }
  if (!context.hasTransientUserActivation) {
    return rejected("External link message has no transient user activation.");
  }
  if (context.duplicateExternalOpen) {
    return rejected("Duplicate external link message was ignored.");
  }
  if (!isExternalHttpUrl(message.href)) {
    return rejected("External link scheme is not allowed.");
  }
  return { accepted: true, action: { type: "openExternal", href: message.href } };
}

export function shouldProcessDocumentAsMarkdown(documentType: DocumentType): boolean {
  return documentType === "markdown";
}

export function hasHtmlReadyHandshakeTimedOut(
  readyAccepted: boolean,
  elapsedMilliseconds: number,
): boolean {
  return !readyAccepted && elapsedMilliseconds >= htmlReadyTimeoutMs;
}

function parseHtmlBridgeMessage(value: unknown): HtmlBridgeMessage | null {
  if (
    !isPlainRecord(value) ||
    value.channel !== "markdown-viewer-html" ||
    (value.type !== "ready" && value.type !== "openExternal")
  ) {
    return null;
  }
  const keys = Object.keys(value).sort();
  if (value.type === "ready") {
    return keys.join(",") === "channel,type"
      ? { channel: "markdown-viewer-html", type: "ready" }
      : null;
  }
  return keys.join(",") === "channel,href,type" && typeof value.href === "string"
    ? { channel: "markdown-viewer-html", type: "openExternal", href: value.href }
    : null;
}

function isHtmlPreviewUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "mvhtml:" && url.hostname === "localhost") ||
      (url.protocol === "http:" && url.hostname === "mvhtml.localhost")
    ) && url.pathname.startsWith("/document/");
  } catch {
    return false;
  }
}

function isExternalHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejected(reason: string): HtmlBridgeDecision {
  return { accepted: false, reason };
}

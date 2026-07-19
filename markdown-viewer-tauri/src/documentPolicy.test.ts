import { describe, expect, it } from "vitest";
import {
  evaluateHtmlBridgeMessage,
  hasHtmlReadyHandshakeTimedOut,
  htmlReadyTimeoutMs,
  parseOpenDocumentResponse,
  shouldProcessDocumentAsMarkdown,
  withPreviewRevision,
  type HtmlBridgeContext,
} from "./documentPolicy";

const readyMessage = { channel: "markdown-viewer-html", type: "ready" };
const openMessage = {
  channel: "markdown-viewer-html",
  type: "openExternal",
  href: "https://example.com/spec",
};

const validContext: HtmlBridgeContext = {
  sourceMatches: true,
  origin: "null",
  tabMatches: true,
  revisionMatches: true,
  readyAccepted: true,
  hasTransientUserActivation: true,
  duplicateExternalOpen: false,
};

describe("document response policy", () => {
  it("maps the exclusive Markdown and HTML response shapes", () => {
    expect(
      parseOpenDocumentResponse({
        documentType: "markdown",
        sourceText: "# Spec",
        previewUrl: null,
      }),
    ).toEqual({ documentType: "markdown", sourceText: "# Spec", previewUrl: null });
    expect(
      parseOpenDocumentResponse({
        documentType: "html",
        sourceText: null,
        previewUrl: "mvhtml://localhost/document/spec/index.html",
      }),
    ).toEqual({
      documentType: "html",
      sourceText: null,
      previewUrl: "mvhtml://localhost/document/spec/index.html",
    });
  });

  it("rejects mixed or unexpected response contracts", () => {
    expect(() =>
      parseOpenDocumentResponse({
        documentType: "html",
        sourceText: "<html></html>",
        previewUrl: null,
      }),
    ).toThrow(/contract/);
    expect(() =>
      parseOpenDocumentResponse({
        documentType: "html",
        sourceText: null,
        previewUrl: "https://example.com/spec.html",
      }),
    ).toThrow(/contract/);
  });

  it("adds only the revision query to a platform preview URL", () => {
    expect(withPreviewRevision("mvhtml://localhost/document/spec/index.html", 3)).toBe(
      "mvhtml://localhost/document/spec/index.html?revision=3",
    );
    expect(withPreviewRevision("http://mvhtml.localhost/document/spec/index.html", 4)).toBe(
      "http://mvhtml.localhost/document/spec/index.html?revision=4",
    );
  });
});

describe("HTML bridge policy", () => {
  it("accepts one ready handshake", () => {
    expect(
      evaluateHtmlBridgeMessage(readyMessage, { ...validContext, readyAccepted: false }),
    ).toEqual({ accepted: true, action: { type: "ready" } });
    expect(evaluateHtmlBridgeMessage(readyMessage, validContext).accepted).toBe(false);
  });

  it.each([
    [{ ...validContext, sourceMatches: false }, "source"],
    [{ ...validContext, origin: "mvhtml://localhost" }, "origin"],
    [{ ...validContext, tabMatches: false }, "stale"],
    [{ ...validContext, revisionMatches: false }, "stale"],
    [{ ...validContext, hasTransientUserActivation: false }, "activation"],
    [{ ...validContext, duplicateExternalOpen: true }, "Duplicate"],
  ])("rejects invalid context", (context, reason) => {
    const decision = evaluateHtmlBridgeMessage(openMessage, context);
    expect(decision.accepted).toBe(false);
    if (!decision.accepted) expect(decision.reason).toContain(reason);
  });

  it.each(["file:///tmp/spec", "javascript:alert(1)", "data:text/html,test", "mailto:a@b.test", "mvhtml://localhost/document/a.html"])(
    "rejects unsupported external scheme %s",
    (href) => {
      expect(evaluateHtmlBridgeMessage({ ...openMessage, href }, validContext).accepted).toBe(false);
    },
  );

  it.each(["http://example.com", "https://example.com/path"])(
    "accepts external HTTP URL %s",
    (href) => {
      expect(evaluateHtmlBridgeMessage({ ...openMessage, href }, validContext)).toEqual({
        accepted: true,
        action: { type: "openExternal", href },
      });
    },
  );

  it("rejects malformed and extra message fields", () => {
    expect(evaluateHtmlBridgeMessage(null, validContext).accepted).toBe(false);
    expect(
      evaluateHtmlBridgeMessage({ ...openMessage, unexpected: true }, validContext).accepted,
    ).toBe(false);
  });
});

describe("document processing branch", () => {
  it("runs Markdown-only processing only for Markdown", () => {
    expect(shouldProcessDocumentAsMarkdown("markdown")).toBe(true);
    expect(shouldProcessDocumentAsMarkdown("html")).toBe(false);
  });

  it("marks a missing ready handshake as timed out at five seconds", () => {
    expect(hasHtmlReadyHandshakeTimedOut(false, htmlReadyTimeoutMs - 1)).toBe(false);
    expect(hasHtmlReadyHandshakeTimedOut(false, htmlReadyTimeoutMs)).toBe(true);
    expect(hasHtmlReadyHandshakeTimedOut(true, htmlReadyTimeoutMs)).toBe(false);
  });
});

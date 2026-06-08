/**
 * Tests for dashboard.js — DashboardProvider
 */
const assert = require("assert");
const { DashboardProvider } = require("../../src/dashboard");

describe("dashboard", () => {
  let provider;

  beforeEach(() => {
    provider = new DashboardProvider({ fsPath: "/fake/extension" }, null);
  });

  it("exports DashboardProvider and is constructable", () => {
    assert.ok(DashboardProvider, "DashboardProvider should be exported");
    assert.ok(provider instanceof DashboardProvider, "Should be an instance of DashboardProvider");
  });

  it("_getHtml() returns a string", () => {
    const html = provider._getHtml();
    assert.strictEqual(typeof html, "string", "_getHtml() should return a string");
    assert.ok(html.length > 0, "_getHtml() should return non-empty string");
  });

  it("_getHtml() contains CSP meta tag", () => {
    const html = provider._getHtml();
    assert.ok(
      html.includes('http-equiv="Content-Security-Policy"'),
      'HTML should contain <meta http-equiv="Content-Security-Policy">'
    );
  });

  it("_getHtml() contains nonce= in script tag", () => {
    const html = provider._getHtml();
    assert.ok(
      html.includes("nonce="),
      'HTML should contain nonce= attribute on <script> tag'
    );
    assert.match(
      html,
      /<script nonce="[^"]+"/,
      '<script> tag should have a non-empty nonce attribute'
    );
  });

  it("_getHtml() contains id=\"btnRun\" without onclick", () => {
    const html = provider._getHtml();
    assert.ok(html.includes('id="btnRun"'), 'HTML should contain id="btnRun"');
    assert.ok(
      !html.includes('onclick='),
      'HTML must not contain any onclick= inline handlers'
    );
  });

  it("_getHtml() contains no onchange= inline handlers", () => {
    const html = provider._getHtml();
    assert.ok(
      !html.includes('onchange='),
      'HTML must not contain any onchange= inline handlers'
    );
  });

  it("_getHtml() contains id=\"status-empty\" for status empty state", () => {
    const html = provider._getHtml();
    assert.ok(
      html.includes('id="status-empty"'),
      'HTML should contain id="status-empty" for the status tab empty state'
    );
  });

  it("_getHtml() contains id=\"config-loading\" for config loading state", () => {
    const html = provider._getHtml();
    assert.ok(
      html.includes('id="config-loading"'),
      'HTML should contain id="config-loading" for the config tab loading state'
    );
  });

  it("_getHtml() generates a unique nonce on each call", () => {
    const html1 = provider._getHtml();
    const html2 = provider._getHtml();
    const nonce1 = html1.match(/<script nonce="([^"]+)"/)?.[1];
    const nonce2 = html2.match(/<script nonce="([^"]+)"/)?.[1];
    assert.ok(nonce1, "Should have a nonce in first call");
    assert.ok(nonce2, "Should have a nonce in second call");
    assert.notStrictEqual(nonce1, nonce2, "Each call should produce a unique nonce");
  });
});

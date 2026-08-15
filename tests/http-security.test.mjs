import assert from "node:assert/strict";
import test from "node:test";
import {
  applyArcadiaSecurityHeaders,
  isRejectedCrossSiteApiMutation,
} from "../app/http-security.ts";

test("mutacoes da API recusam origem cruzada sem bloquear navegacao segura", () => {
  const base = {
    fetchSite: "same-origin",
    origin: "https://arcadia.example",
    pathname: "/api/game",
    requestOrigin: "https://arcadia.example",
  };
  assert.equal(
    isRejectedCrossSiteApiMutation({ ...base, method: "POST" }),
    false,
  );
  assert.equal(
    isRejectedCrossSiteApiMutation({
      ...base,
      fetchSite: "cross-site",
      method: "POST",
    }),
    true,
  );
  assert.equal(
    isRejectedCrossSiteApiMutation({
      ...base,
      method: "POST",
      origin: "https://attacker.example",
    }),
    true,
  );
  assert.equal(
    isRejectedCrossSiteApiMutation({
      ...base,
      method: "POST",
      origin: "not a url",
    }),
    true,
  );
  assert.equal(
    isRejectedCrossSiteApiMutation({
      ...base,
      fetchSite: "cross-site",
      method: "GET",
    }),
    false,
  );
  assert.equal(
    isRejectedCrossSiteApiMutation({
      ...base,
      fetchSite: null,
      origin: null,
      method: "POST",
    }),
    true,
  );
  assert.equal(
    isRejectedCrossSiteApiMutation({
      ...base,
      fetchSite: null,
      origin: null,
      pathname: "/api/wallet/nowpayments",
      method: "POST",
    }),
    false,
  );
});

test("respostas recebem cabecalhos defensivos", () => {
  const headers = new Headers();
  applyArcadiaSecurityHeaders(headers, true);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("x-dns-prefetch-control"), "off");
  assert.equal(headers.get("origin-agent-cluster"), "?1");
  assert.match(headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(
    headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );
});

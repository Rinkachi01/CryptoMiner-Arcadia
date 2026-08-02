import assert from "node:assert/strict";
import test from "node:test";
import {
  applyArcadiaSecurityHeaders,
  isRejectedCrossSiteApiMutation,
} from "../app/http-security.ts";

test("mutações da API recusam origem cruzada sem bloquear navegação segura", () => {
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
      fetchSite: "cross-site",
      method: "GET",
    }),
    false,
  );
});

test("respostas recebem cabeçalhos defensivos sem reivindicar subdomínios alheios", () => {
  const headers = new Headers();
  applyArcadiaSecurityHeaders(headers, true);
  assert.equal(headers.get("x-content-type-options"), "nosniff");
  assert.equal(headers.get("x-frame-options"), "DENY");
  assert.equal(headers.get("strict-transport-security"), "max-age=31536000");
  assert.doesNotMatch(
    headers.get("strict-transport-security") ?? "",
    /includeSubDomains/i,
  );
});

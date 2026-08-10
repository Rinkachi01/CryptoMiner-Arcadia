import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("modelos de autenticação preservam links seguros e suporte", async () => {
  const [confirmation, recovery, magic, changeEmail, passwordChanged] =
    await Promise.all([
      readFile(new URL("../docs/email-templates/confirm-signup.html", import.meta.url), "utf8"),
      readFile(new URL("../docs/email-templates/reset-password.html", import.meta.url), "utf8"),
      readFile(new URL("../docs/email-templates/magic-link.html", import.meta.url), "utf8"),
      readFile(new URL("../docs/email-templates/change-email.html", import.meta.url), "utf8"),
      readFile(new URL("../docs/email-templates/password-changed.html", import.meta.url), "utf8"),
    ]);
  for (const source of [confirmation, recovery, magic, changeEmail]) {
    assert.match(source, /\{\{ \.ConfirmationURL \}\}/);
    assert.doesNotMatch(source, /seed phrase.*solicita|chave privada.*solicita/i);
  }
  assert.match(confirmation, /\{\{ \.SiteURL \}\}\/support/);
  assert.match(recovery, /\{\{ \.SiteURL \}\}\/support/);
  assert.match(changeEmail, /\{\{ \.NewEmail \}\}/);
  assert.match(passwordChanged, /\{\{ \.Email \}\}/);
  assert.match(passwordChanged, /auth\?mode=reset/);
});

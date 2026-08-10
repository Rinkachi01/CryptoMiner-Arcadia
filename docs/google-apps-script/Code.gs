const ARCADIA_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const ARCADIA_IDEMPOTENCY_TTL_SECONDS = 6 * 60 * 60;

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function property(name) {
  return String(
    PropertiesService.getScriptProperties().getProperty(name) || "",
  ).trim();
}

function bytesToHex(bytes) {
  return bytes
    .map(function (value) {
      return ((value + 256) % 256).toString(16).padStart(2, "0");
    })
    .join("");
}

function secureEqual(first, second) {
  first = String(first || "");
  second = String(second || "");
  if (first.length !== 64 || second.length !== 64) return false;
  var difference = 0;
  for (var index = 0; index < 64; index += 1) {
    difference |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }
  return difference === 0;
}

function validEmail(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function plainText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function doGet() {
  return jsonResponse({ ok: true, service: "arcadia-mail-bridge" });
}

function doPost(event) {
  try {
    var secret = property("ARCADIA_MAIL_SECRET");
    var supportEmail = property("ARCADIA_SUPPORT_EMAIL");
    if (secret.length < 32 || !validEmail(supportEmail)) {
      return jsonResponse({ ok: false, error: "configuration_pending" });
    }

    var request = JSON.parse(
      event && event.postData && event.postData.contents
        ? event.postData.contents
        : "{}",
    );
    var timestamp = Number(request.timestamp);
    var idempotencyKey = String(request.idempotencyKey || "");
    var message = request.message || {};
    if (
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() - timestamp) > ARCADIA_MAX_CLOCK_SKEW_MS ||
      !/^support-(ticket|reply)-[A-Za-z0-9-]{8,160}$/.test(idempotencyKey)
    ) {
      return jsonResponse({ ok: false, error: "invalid_request" });
    }

    var canonical =
      timestamp + "." + idempotencyKey + "." + JSON.stringify(message);
    var expectedSignature = bytesToHex(
      Utilities.computeHmacSha256Signature(
        canonical,
        secret,
        Utilities.Charset.UTF_8,
      ),
    );
    if (!secureEqual(request.signature, expectedSignature)) {
      return jsonResponse({ ok: false, error: "invalid_signature" });
    }

    if (
      (message.type !== "ticket" && message.type !== "reply") ||
      typeof message.subject !== "string" ||
      message.subject.length < 1 ||
      message.subject.length > 180 ||
      typeof message.html !== "string" ||
      message.html.length < 1 ||
      message.html.length > 20000
    ) {
      return jsonResponse({ ok: false, error: "invalid_message" });
    }

    var cache = CacheService.getScriptCache();
    if (cache.get(idempotencyKey)) {
      return jsonResponse({ ok: true, id: idempotencyKey, repeated: true });
    }
    var recipient = message.type === "ticket" ? supportEmail : message.to;
    if (!validEmail(recipient)) {
      return jsonResponse({ ok: false, error: "invalid_recipient" });
    }
    if (MailApp.getRemainingDailyQuota() < 1) {
      return jsonResponse({ ok: false, error: "daily_quota_exhausted" });
    }

    MailApp.sendEmail({
      to: recipient,
      subject: message.subject,
      body: plainText(message.html),
      htmlBody: message.html,
      name: "Crypto Miner Arcadia",
      replyTo: supportEmail,
    });
    cache.put(idempotencyKey, "sent", ARCADIA_IDEMPOTENCY_TTL_SECONDS);
    return jsonResponse({ ok: true, id: idempotencyKey });
  } catch (error) {
    console.error(
      JSON.stringify({
        message: "arcadia_mail_bridge_failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return jsonResponse({ ok: false, error: "mail_bridge_failed" });
  }
}

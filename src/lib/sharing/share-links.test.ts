import assert from "node:assert/strict";
import test from "node:test";
import {
  createViewCookieValue,
  verifyViewCookie,
} from "@/lib/sharing/share-links";

test("firma la cookie de acceso y rechaza valores falsificados", () => {
  const previousSecret = process.env.SHARE_LINK_SECRET;
  process.env.SHARE_LINK_SECRET = "test-secret";
  try {
    const code = "AbCd1234";
    const signature = createViewCookieValue(code);

    assert.equal(verifyViewCookie(code, signature), true);
    assert.equal(verifyViewCookie(code, "1"), false);
    assert.equal(verifyViewCookie(code, `${signature.slice(0, -1)}x`), false);
    assert.equal(verifyViewCookie("otro-code", signature), false);
  } finally {
    if (previousSecret === undefined) delete process.env.SHARE_LINK_SECRET;
    else process.env.SHARE_LINK_SECRET = previousSecret;
  }
});

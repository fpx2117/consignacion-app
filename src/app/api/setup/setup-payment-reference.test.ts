import assert from "node:assert/strict";
import test from "node:test";
import {
  createSetupPaymentReference,
  isVerifiedMercadoPagoActivation,
  isVerifiedPayPalSubscription,
  isPayPalSubscriptionId,
  verifySetupPaymentReference,
} from "./setup-payment-reference";

const secret = "test-only-setup-reference-secret";
const email = "admin@example.com";

test("vincula la referencia de pago al plan seleccionado", () => {
  const reference = createSetupPaymentReference(2, email, secret);
  assert.equal(verifySetupPaymentReference(reference, 2, email, secret), true);
  assert.equal(verifySetupPaymentReference(reference, 3, email, secret), false);
  assert.equal(
    verifySetupPaymentReference(reference, 2, "other@example.com", secret),
    false,
  );
});

test("rechaza referencias manipuladas o sin firma", () => {
  const reference = createSetupPaymentReference(2, email, secret);
  assert.equal(
    verifySetupPaymentReference(
      reference.replace("setup:2", "setup:3"),
      3,
      email,
      secret,
    ),
    false,
  );
  assert.equal(verifySetupPaymentReference("setup:2", 2, email, secret), false);
});

test("genera una referencia no reutilizable por intento", () => {
  assert.notEqual(
    createSetupPaymentReference(2, email, secret),
    createSetupPaymentReference(2, email, secret),
  );
});

test("valida estado, plan y referencia devueltos por el proveedor", () => {
  const reference = createSetupPaymentReference(2, email, secret);
  process.env.JWT_SECRET = secret;
  assert.equal(
    isVerifiedPayPalSubscription(
      { status: "ACTIVE", plan_id: "paypal-pro", custom_id: reference },
      { id: 2, paypalId: "paypal-pro" },
      email,
    ),
    true,
  );
  assert.equal(
    isVerifiedMercadoPagoActivation(
      { status: "approved", external_reference: reference },
      "approved",
      2,
      email,
    ),
    true,
  );
  assert.equal(
    isVerifiedMercadoPagoActivation(
      { status: "approved", external_reference: reference },
      "approved",
      3,
      email,
    ),
    false,
  );
});

test("reconoce IDs actuales de suscripción PayPal", () => {
  assert.equal(isPayPalSubscriptionId("I-ABC123"), true);
  assert.equal(isPayPalSubscriptionId("123456789"), false);
});

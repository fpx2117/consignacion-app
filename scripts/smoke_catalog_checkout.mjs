import fs from "node:fs/promises";
import puppeteer from "puppeteer";

const BASE_URL = "http://localhost:3000";
const CATALOG_URL = `${BASE_URL}/lista?sucursalId=1`;

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || `HTTP ${response.status} en ${url}`);
  }
  return payload;
}

async function runApiSmoke() {
  const catalog = await fetchJson(`${BASE_URL}/api/public/lista-precios?sucursalId=1`);
  const data = catalog.data ?? catalog;
  const productos = data.productos ?? [];
  const config = data.config ?? {};

  assertTrue(productos.length > 0, "La API pública no devolvió productos");
  assertTrue(Boolean(config.convertirTienda), "La tienda pública no tiene checkout habilitado");

  const product = productos.find((item) => Number(item.stockDisponibleUnits || 0) > 0);
  assertTrue(Boolean(product), "No hay productos con stock para probar checkout");

  const checkout = await fetchJson(`${BASE_URL}/api/public/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sucursalId: 1,
      items: [{ id: product.id, quantity: 1 }],
      clienteData: {
        nombre: "QA MercadoPago",
        email: "qa.mercadopago@example.com",
        telefono: "1100000000",
      },
      envioData: {
        metodoEnvio: "RETIRO_LOCAL",
        costo: 0,
      },
    }),
  });

  assertTrue(Boolean(checkout.init_point), "El checkout público no devolvió init_point");
  assertTrue(Boolean(checkout.checkout_token), "El checkout público no devolvió checkout_token");
  assertTrue(String(checkout.init_point).includes("mercadopago"), "El init_point no apunta a MercadoPago");

  const statusResponse = await fetchJson(`${BASE_URL}/api/public/checkout/status?token=${checkout.checkout_token}`);
  const statusData = statusResponse.data ?? statusResponse;
  assertTrue(statusData.status === "PENDING", "El checkout recién creado debería quedar en PENDING");

  return {
    productId: product.id,
    productName: product.nombre,
    checkoutToken: checkout.checkout_token,
    initPoint: checkout.init_point,
    status: statusData.status,
  };
}

async function runUiSmoke() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(`console:${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleErrors.push(`pageerror:${error.message}`);
  });

  await page.goto(CATALOG_URL, { waitUntil: "networkidle2", timeout: 120000 });
  await page.screenshot({ path: "catalog-smoke-home.png", fullPage: true });

  await page.waitForSelector('button[aria-label="Agregar al carrito"]', { timeout: 20000 });
  await page.click('button[aria-label="Agregar al carrito"]');

  await page.click('button[aria-label="Abrir carrito"]');
  await page.waitForSelector("body", { timeout: 10000 });
  const bodyText = await page.evaluate(() => document.body.innerText);
  assertTrue(bodyText.includes("vista previa del ticket"), "No apareció la vista previa del ticket en el carrito");
  await page.screenshot({ path: "catalog-smoke-cart.png", fullPage: true });

  const continueButtons = await page.$$("button");
  for (const button of continueButtons) {
    const text = await page.evaluate((element) => element.textContent || "", button);
    if (text.trim() === "Continuar") {
      await button.click();
      break;
    }
  }

  await page.waitForSelector('input[name="nombre"]', { timeout: 10000 });
  await page.type('input[name="nombre"]', "QA MercadoPago");
  await page.type('input[name="email"]', "qa.mercadopago@example.com");

  const secondContinueButtons = await page.$$("button");
  for (const button of secondContinueButtons) {
    const text = await page.evaluate((element) => element.textContent || "", button);
    if (text.trim() === "Continuar") {
      await button.click();
      break;
    }
  }

  const pickupCandidate = await page.$x("//p[contains(., 'Retiro por el local')]");
  assertTrue(pickupCandidate.length > 0, "No apareció la opción 'Retiro por el local'");
  await pickupCandidate[0].click();

  const finalText = await page.evaluate(() => document.body.innerText);
  assertTrue(finalText.includes("Ir al pago"), "No apareció el botón final de pago");

  await browser.close();
  await fs.access("catalog-smoke-home.png");
  await fs.access("catalog-smoke-cart.png");

  return {
    consoleErrors,
    homeScreenshot: "catalog-smoke-home.png",
    cartScreenshot: "catalog-smoke-cart.png",
  };
}

try {
  const api = await runApiSmoke();
  const ui = await runUiSmoke();
  console.log(JSON.stringify({ ok: true, api, ui }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
}

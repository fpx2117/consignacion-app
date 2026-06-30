from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:3000"
CATALOG_URL = f"{BASE_URL}/lista?sucursalId=1"


def fetch_json(url: str, payload: dict | None = None) -> dict:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def assert_true(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def run_api_smoke() -> dict:
    catalog = fetch_json(f"{BASE_URL}/api/public/lista-precios?sucursalId=1")
    data = catalog.get("data") or catalog
    productos = data.get("productos", [])
    config = data.get("config", {})

    assert_true(bool(productos), "La API pública no devolvió productos")
    assert_true(bool(config.get("convertirTienda")), "La tienda pública no tiene checkout habilitado")

    product = next((item for item in productos if (item.get("stockDisponibleUnits") or 0) > 0), None)
    assert_true(product is not None, "No hay productos con stock para probar checkout")

    payload = {
        "sucursalId": 1,
        "items": [{"id": product["id"], "quantity": 1}],
        "clienteData": {
            "nombre": "QA MercadoPago",
            "email": "qa.mercadopago@example.com",
            "telefono": "1100000000",
        },
        "envioData": {
            "metodoEnvio": "RETIRO_LOCAL",
            "costo": 0,
        },
    }

    checkout = fetch_json(f"{BASE_URL}/api/public/checkout", payload)
    init_point = checkout.get("init_point")
    checkout_token = checkout.get("checkout_token")

    assert_true(bool(init_point), "El checkout público no devolvió init_point")
    assert_true(bool(checkout_token), "El checkout público no devolvió checkout_token")

    parsed = urllib.parse.urlparse(init_point)
    assert_true("mercadopago" in parsed.netloc.lower(), "El init_point no apunta a MercadoPago")

    status_response = fetch_json(f"{BASE_URL}/api/public/checkout/status?token={checkout_token}")
    status_data = status_response.get("data") or status_response
    assert_true(status_data.get("status") == "PENDING", "El checkout recién creado debería quedar en PENDING")

    return {
        "product_id": product["id"],
        "product_name": product["nombre"],
        "checkout_token": checkout_token,
        "init_point": init_point,
        "status": status_data.get("status"),
    }


def run_ui_smoke() -> dict:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1200})
        console_errors: list[str] = []
        page.on("console", lambda message: console_errors.append(f"console:{message.type}:{message.text}") if message.type == "error" else None)
        page.on("pageerror", lambda error: console_errors.append(f"pageerror:{error}"))

        page.goto(CATALOG_URL, wait_until="networkidle", timeout=120000)
        page.screenshot(path="catalog-smoke-home.png", full_page=True)

        add_buttons = page.locator('button[aria-label="Agregar al carrito"]')
        assert_true(add_buttons.count() > 0, "No encontré botones para agregar productos al carrito")
        add_buttons.first.click()

        page.locator('button[aria-label="Abrir carrito"]').first.click()
        page.wait_for_selector("text=vista previa del ticket", timeout=15000)
        page.screenshot(path="catalog-smoke-cart.png", full_page=True)

        page.get_by_text("Continuar", exact=True).click()
        page.locator('input[name="nombre"]').fill("QA MercadoPago")
        page.locator('input[name="email"]').fill("qa.mercadopago@example.com")
        page.get_by_text("Continuar", exact=True).click()
        page.get_by_text("Retiro por el local", exact=False).click()

        final_button = page.locator("button").filter(has_text="Ir al pago")
        assert_true(final_button.count() > 0, "No encontré el botón final de pago")

        browser.close()

    return {
        "console_errors": console_errors,
        "home_screenshot": "catalog-smoke-home.png",
        "cart_screenshot": "catalog-smoke-cart.png",
    }


def main() -> int:
    try:
        api_result = run_api_smoke()
        ui_result = run_ui_smoke()
    except (AssertionError, urllib.error.URLError, TimeoutError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False, indent=2))
        return 1
    except Exception as error:  # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"Fallo inesperado: {error}"}, ensure_ascii=False, indent=2))
        return 1

    print(json.dumps({"ok": True, "api": api_result, "ui": ui_result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CheckoutPage from "../src/app/checkout/page";
import { InstagramPurchaseNotice } from "../src/components/purchase/InstagramPurchaseNotice";

void test("purchase guidance links customers to the store Instagram account", () => {
  const html = renderToStaticMarkup(<InstagramPurchaseNotice />);
  const text = html.replace(/<[^>]+>/g, "");

  assert.match(html, /Payments are unavailable on this website/);
  assert.match(html, /href="https:\/\/instagram\.com\/realdealkickzsc"/);
  assert.match(text, /Message @realdealkickzsc on Instagram to purchase/);
});

void test("checkout is an unavailable-payment page with the Instagram purchase path", () => {
  const html = renderToStaticMarkup(<CheckoutPage />);

  assert.match(html, /Online checkout is unavailable/);
  assert.match(html, /href="https:\/\/instagram\.com\/realdealkickzsc"/);
  assert.doesNotMatch(html, /<form|<script/);
});

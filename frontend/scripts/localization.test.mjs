import test from "node:test";
import assert from "node:assert/strict";
import { translateText } from "../src/localization.js";

test("uses established oil-trading terminology", () => {
  assert.equal(translateText("Base Oils"), "روغن‌های پایه");
  assert.equal(translateText("Industrial Lubricants"), "روانکارهای صنعتی");
  assert.equal(translateText("Request a Quote"), "درخواست استعلام قیمت");
  assert.equal(translateText("Certificate of Analysis (COA)"), "گواهی آنالیز (COA)");
  assert.equal(translateText("Incoterms"), "اینکوترمز");
  assert.equal(translateText("Proforma invoices"), "پیش‌فاکتورها");
});

test("retains business codes and original English copy", () => {
  assert.equal(translateText("SN500"), "SN500");
  assert.equal(translateText("FOB"), "FOB");
  assert.equal(translateText("MT", "en"), "MT");
  assert.equal(translateText("Base Oils", "en"), "Base Oils");
});

test("translates navigation and count patterns", () => {
  assert.equal(translateText("View Products →"), "مشاهده محصولات ←");
  assert.equal(translateText("Home › Products"), "خانه ‹ محصولات");
  assert.equal(translateText("Showing 1–6 of 6 products"), "نمایش ۱–۶ از ۶ محصول");
  assert.equal(translateText("Records 1–100"), "رکوردهای ۱ تا ۱۰۰");
});

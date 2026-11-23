import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEnamadEmbed } from "../lib/enamad";

const href = "https://trustseal.enamad.ir/?id=12345&Code=ExampleCode";
const src = "https://trustseal.enamad.ir/logo.aspx?id=12345&Code=ExampleCode";
const embed = `<a referrerpolicy='origin' target='_blank' href='${href}'>
  <img referrerpolicy='origin' src='${src}' alt='' style='cursor:pointer' code='ExampleCode'>
</a>`;

test("accepts the Enamad embed and equivalent pasted formats", () => {
  const expected = { href, src, code: "ExampleCode" };
  assert.deepEqual(parseEnamadEmbed(embed), expected);
  assert.deepEqual(parseEnamadEmbed(embed.replaceAll("&", "&amp;").replaceAll("'", '"')), expected);
  assert.deepEqual(parseEnamadEmbed(embed.replace(/[<>:]/g, "\\$&")), expected);
});

test("rejects empty, mismatched and untrusted embeds", () => {
  assert.equal(parseEnamadEmbed(""), null);
  assert.equal(parseEnamadEmbed(embed.replace(src, src.replace("ExampleCode", "OtherCode"))), null);
  assert.equal(parseEnamadEmbed(embed.replace(src, src.replace(".ir/", ".ir.example.org/"))), null);
  assert.equal(parseEnamadEmbed(embed.replace(href, "javascript:alert(1)")), null);
  assert.equal(parseEnamadEmbed(`${embed}<script></script>`), null);
});

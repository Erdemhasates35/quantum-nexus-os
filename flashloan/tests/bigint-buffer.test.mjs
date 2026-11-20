import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { toBigIntLE, toBigIntBE, toBufferLE, toBufferBE } = require("../vendor/bigint-buffer/dist/node.js");

test("little-endian and big-endian round trips", () => {
  const value = 0x123456789abcdefn;
  assert.equal(toBigIntLE(toBufferLE(value, 8)), value);
  assert.equal(toBigIntBE(toBufferBE(value, 8)), value);
});
test("empty buffers represent zero", () => {
  assert.equal(toBigIntLE(Buffer.alloc(0)), 0n);
  assert.equal(toBigIntBE(Buffer.alloc(0)), 0n);
});
test("rejects unbounded inputs and widths", () => {
  assert.throws(() => toBigIntLE(Buffer.alloc(4097)), RangeError);
  assert.throws(() => toBufferLE(1n, 4097), RangeError);
  assert.throws(() => toBufferLE(256n, 1), RangeError);
});

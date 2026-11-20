"use strict";
const MAX_BYTES = 4096;
function assertBuffer(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) throw new TypeError("Expected Buffer or Uint8Array");
  if (value.byteLength > MAX_BYTES) throw new RangeError("BigInt buffer input exceeds 4096 bytes");
}
function assertWidth(width) {
  if (!Number.isSafeInteger(width) || width < 0 || width > MAX_BYTES) throw new RangeError("Invalid BigInt buffer width");
}
function toBigIntLE(input) {
  assertBuffer(input);
  let value = 0n;
  for (let i = input.length - 1; i >= 0; i--) value = (value << 8n) | BigInt(input[i]);
  return value;
}
function toBigIntBE(input) {
  assertBuffer(input);
  let value = 0n;
  for (let i = 0; i < input.length; i++) value = (value << 8n) | BigInt(input[i]);
  return value;
}
function toBufferLE(input, width) {
  assertWidth(width);
  let value = BigInt(input);
  if (value < 0n || (width === 0 && value !== 0n) || (width > 0 && value >= (1n << BigInt(width * 8)))) {
    throw new RangeError("BigInt does not fit the requested unsigned width");
  }
  const output = Buffer.alloc(width);
  for (let i = 0; i < width; i++) {
    output[i] = Number(value & 255n);
    value >>= 8n;
  }
  return output;
}
function toBufferBE(input, width) {
  const output = toBufferLE(input, width);
  output.reverse();
  return output;
}
module.exports = { toBigIntLE, toBigIntBE, toBufferLE, toBufferBE };

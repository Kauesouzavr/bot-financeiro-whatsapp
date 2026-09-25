import { createHmac, timingSafeEqual } from "node:crypto";

// Valida o cabeçalho X-Hub-Signature-256 sobre o corpo CRU da requisição
// (antes do JSON.parse), como a Meta exige. Usa timingSafeEqual pra evitar
// timing attack na comparação.
export function isValidSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader) return false;

  const expected =
    "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

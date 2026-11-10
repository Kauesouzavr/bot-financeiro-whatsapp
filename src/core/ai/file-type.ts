import type { RECEIPT_ALLOWED_MIME_TYPES } from "./receipt";

type ReceiptMimeType = (typeof RECEIPT_ALLOWED_MIME_TYPES)[number];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

// Descobre o tipo REAL do arquivo pelos primeiros bytes, em vez de confiar no tipo que o navegador
// declarou (quem manda o arquivo pode declarar qualquer coisa). Devolve null se não for um dos tipos aceitos.
export function sniffReceiptMimeType(bytes: Uint8Array): ReceiptMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // WebP: "RIFF" + 4 bytes de tamanho + "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  // PDF: "%PDF-"
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf";
  return null;
}

import type { RECEIPT_ALLOWED_MIME_TYPES } from "./receipt";
import type { VoiceMimeType } from "./voice";

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

// Mesma ideia para a gravação de voz: o tipo vem dos primeiros bytes, não do que o navegador declarou.
export function sniffAudioMimeType(bytes: Uint8Array): VoiceMimeType | null {
  // MP4/M4A (o que o iPhone grava): 4 bytes de tamanho + "ftyp"
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return "audio/mp4";
  // WebM (Android e computador): cabeçalho EBML
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "audio/webm";
  // OGG: "OggS"
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return "audio/ogg";
  // WAV: "RIFF" + 4 bytes de tamanho + "WAVE"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)
  ) {
    return "audio/wav";
  }
  return null;
}

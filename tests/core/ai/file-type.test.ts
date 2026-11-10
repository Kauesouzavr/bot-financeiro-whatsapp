import { describe, expect, it } from "vitest";
import { sniffAudioMimeType, sniffReceiptMimeType } from "@/core/ai/file-type";

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

describe("sniffReceiptMimeType", () => {
  it("reconhece JPEG, PNG, WebP e PDF pelos primeiros bytes", () => {
    expect(sniffReceiptMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffReceiptMimeType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(
      sniffReceiptMimeType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50)),
    ).toBe("image/webp");
    expect(sniffReceiptMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37))).toBe(
      "application/pdf",
    );
  });

  it("RIFF que não é WebP (ex.: um WAV) não passa", () => {
    expect(
      sniffReceiptMimeType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)),
    ).toBeNull();
  });

  it("recusa texto, HTML, executáveis e arquivo vazio, mesmo que o nome diga que é imagem", () => {
    const encoder = new TextEncoder();
    expect(sniffReceiptMimeType(encoder.encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffReceiptMimeType(encoder.encode("MZ executavel"))).toBeNull();
    expect(sniffReceiptMimeType(new Uint8Array())).toBeNull();
    expect(sniffReceiptMimeType(bytes(0xff, 0xd8))).toBeNull();
  });
});

describe("sniffAudioMimeType", () => {
  it('reconhece o MP4/M4A que o iPhone grava ("ftyp" depois de 4 bytes de tamanho)', () => {
    expect(
      sniffAudioMimeType(bytes(0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20)),
    ).toBe("audio/mp4");
  });

  it("reconhece WebM, OGG e WAV pelos primeiros bytes", () => {
    expect(sniffAudioMimeType(bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42))).toBe("audio/webm");
    expect(sniffAudioMimeType(bytes(0x4f, 0x67, 0x67, 0x53, 0x00, 0x02))).toBe("audio/ogg");
    expect(
      sniffAudioMimeType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)),
    ).toBe("audio/wav");
  });

  it("RIFF que não é WAV (ex.: um WebP) não passa", () => {
    expect(
      sniffAudioMimeType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50)),
    ).toBeNull();
  });

  it("recusa imagem, PDF, texto, HTML e arquivo vazio, mesmo que o nome diga que é áudio", () => {
    const encoder = new TextEncoder();
    expect(sniffAudioMimeType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBeNull();
    expect(sniffAudioMimeType(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31))).toBeNull();
    expect(sniffAudioMimeType(encoder.encode("<html><script>alert(1)</script>"))).toBeNull();
    expect(sniffAudioMimeType(new Uint8Array())).toBeNull();
    expect(sniffAudioMimeType(bytes(0, 0, 0))).toBeNull();
  });

  it("o comprovante e o áudio não se confundem: cada sniff só aceita o seu tipo", () => {
    const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
    const webm = bytes(0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42);
    expect(sniffReceiptMimeType(webm)).toBeNull();
    expect(sniffAudioMimeType(jpeg)).toBeNull();
  });
});

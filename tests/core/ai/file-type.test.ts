import { describe, expect, it } from "vitest";
import { sniffReceiptMimeType } from "@/core/ai/file-type";

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

import { RECEIPT_MAX_BYTES } from "@/core/ai/receipt";
import { fitWithin } from "@/core/chat/image-size";

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.82;

// Roda no celular, antes de enviar: foto de câmera costuma ter 3 a 12 MB, e a Vercel só aceita
// cerca de 4,5 MB por requisição. Reduzo pra no máximo 1600 px no lado maior (o texto do comprovante
// continua legível) e comprimo em JPEG: fica em algumas centenas de KB. PDF vai como está.
// Devolve null se o arquivo não servir (tipo errado ou grande demais).
export async function prepareReceiptFile(file: File): Promise<File | null> {
  if (file.type === "application/pdf") {
    return file.size <= RECEIPT_MAX_BYTES ? file : null;
  }
  if (!file.type.startsWith("image/")) return null;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas indisponível");

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (blob && blob.size <= RECEIPT_MAX_BYTES) {
      return new File([blob], "comprovante.jpg", { type: "image/jpeg" });
    }
  } catch {
    // Formato que o navegador não decodifica: tenta mandar como veio, se couber.
  }

  return file.size <= RECEIPT_MAX_BYTES ? file : null;
}

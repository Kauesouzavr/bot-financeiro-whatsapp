import { ImageResponse } from "next/og";

// Ícone do app gerado por código (um quadrado verde com "R$"), em vez de arquivos de imagem.
// Só os tamanhos que o app usa: 180 (iPhone), 192 e 512 (Android e instalação).
const ALLOWED_SIZES = [180, 192, 512];

export async function GET(_request: Request, context: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await context.params;
  const pixels = Number(size);
  if (!ALLOWED_SIZES.includes(pixels)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#128c7e",
        color: "#ffffff",
        fontSize: Math.round(pixels * 0.42),
        fontWeight: 700,
      }}
    >
      R$
    </div>,
    { width: pixels, height: pixels },
  );
}

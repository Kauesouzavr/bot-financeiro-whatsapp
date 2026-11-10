import type { MetadataRoute } from "next";

// Faz o navegador oferecer "Instalar app" / "Adicionar à tela inicial". Abre direto no chat,
// em tela cheia (sem a barra do navegador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bot Financeiro",
    short_name: "Financeiro",
    description: "Registre gastos e entradas conversando e veja o saldo do mês.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#efeae2",
    theme_color: "#075e54",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

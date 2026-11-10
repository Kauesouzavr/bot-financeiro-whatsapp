import type { NextConfig } from "next";

// Cabeçalhos de segurança aplicados em todas as respostas:
// - X-Frame-Options / frame-ancestors: impede o site de ser embutido em
//   iframe (protege contra clickjacking).
// - X-Content-Type-Options: o navegador não "adivinha" o tipo do arquivo.
// - Referrer-Policy: não vaza a URL completa para outros sites.
// - Permissions-Policy: desliga câmera, microfone e localização.
// - Strict-Transport-Security: força HTTPS por 2 anos.
const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Comprovantes (foto ou PDF) chegam por Server Action: o padrão de 1 MB não cabe.
  // O arquivo em si é limitado a 3 MB no código; sobra espaço pro envelope do formulário.
  // A Vercel também limita o corpo das requisições (cerca de 4,5 MB).
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

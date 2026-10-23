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
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

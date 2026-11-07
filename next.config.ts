import type { NextConfig } from "next";

const cabecalhos = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Extrato OFX/CSV de até 2 MB + o resto do formulário. Ações de servidor já validam a origem (CSRF) por padrão.
    serverActions: { bodySizeLimit: "3mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: cabecalhos },
      // Páginas com dados financeiros não vão para cache compartilhado.
      { source: "/((?!_next/static|_next/image|animacoes|icon.svg).*)", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
      // O service worker precisa ser revalidado sempre e só controla o próprio site.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default nextConfig;

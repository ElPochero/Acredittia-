/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/admin/:view(dashboard|empresas|busqueda|salud|sistemas|auditoria)",
        destination: "/ops/:view",
      },
      {
        source: "/admin/usuarios",
        destination: "/ops/accesos",
      },
      {
        source: "/admin/metricas",
        destination: "/ops/indicadores",
      },
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_INTERNAL_API_URL || "http://api:8000"}/api/v1/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/admin/plataforma", destination: "/admin/empresas", permanent: false },
      { source: "/admin/indicadores", destination: "/admin/metricas", permanent: false },
      { source: "/ops/plataforma", destination: "/admin/empresas", permanent: false },
      { source: "/ops/usuarios", destination: "/admin/usuarios", permanent: false },
      { source: "/ops/indicadores", destination: "/admin/metricas", permanent: false },
    ];
  },
};
export default nextConfig;

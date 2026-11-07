import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyGrana",
    short_name: "MyGrana",
    description: "Controle financeiro pessoal",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4ef",
    theme_color: "#0f5b46",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

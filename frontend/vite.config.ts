import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, root, "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    ...tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  if (command === "build") {
    plugins.push(
      cloudflare({
        viteEnvironment: { name: "ssr" },
      }),
    );
  }

  return {
    define: envDefine,
    resolve: {
      alias: { "@": path.join(root, "src") },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: false,
      allowedHosts: ["on-prem.x-dcb.net"],
      proxy: {
        "/api": { target: "http://on-prem.x-dcb.net:4000", changeOrigin: true },
        "/uploads": { target: "http://on-prem.x-dcb.net:4000", changeOrigin: true },
        "/socket.io": { target: "http://on-prem.x-dcb.net:4000", ws: true, changeOrigin: true },
      },
    },
    plugins,
  };
});

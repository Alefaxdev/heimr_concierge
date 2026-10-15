import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure-SDK-ene kjøres som vanlige Node-pakker på serveren
  serverExternalPackages: ["@azure/identity", "@azure/keyvault-secrets", "@azure/msal-node"],
};

export default nextConfig;

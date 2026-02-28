/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: [
      "@anthropic-ai/sdk",
      "@anthropic-ai/claude-code-sdk-agent",
      "@anthropic-ai/claude-code-sdk-ai",
      "@mariozechner/pi-coding-agent",
      "@mariozechner/pi-ai",
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // These packages are optional and loaded dynamically in pi-sdk-init.ts.
      // Mark them as external so webpack doesn't try to resolve them at build time.
      config.externals = config.externals || [];
      config.externals.push(
        "@anthropic-ai/claude-code-sdk-agent",
        "@anthropic-ai/claude-code-sdk-ai",
        "@mariozechner/pi-coding-agent",
        "@mariozechner/pi-ai",
      );
    }
    return config;
  },
};

export default nextConfig;

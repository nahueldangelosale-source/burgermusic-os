/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/api",
    "googleapis",
    "xlsx",
    "bcryptjs",
    "dotenv",
  ],
  experimental: {
    viewTransition: true,
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "sonner",
      "@radix-ui/react-slot",
    ],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;

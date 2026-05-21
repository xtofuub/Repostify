import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Allow any LAN host on the 192.168.* range during dev — useful when
  // testing on phones/tablets via the network address Next prints at boot.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.56.1",
    "192.168.101.105",
    "192.168.0.0/16",
  ],
};

export default nextConfig;

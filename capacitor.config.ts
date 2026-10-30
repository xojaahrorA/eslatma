import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "uz.universallife.os",
  appName: "Life OS",
  webDir: "out",
  android: {
    allowMixedContent: false,
    backgroundColor: "#12101c",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;

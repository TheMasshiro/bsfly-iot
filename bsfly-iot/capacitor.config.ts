import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cpe.bsflyiot",
  appName: "bsfly-iot",
  webDir: "dist",
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      // iconColor: "#488AFF",
      // sound: "beep.wav",
    },
  },
};

export default config;

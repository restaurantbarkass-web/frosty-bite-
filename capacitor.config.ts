import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.frostybite.app',
  appName: 'Frosty Bite',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      'ais-dev-krfjonjkmvmohb4isfawvp-706739706976.asia-southeast1.run.app',
      'ais-pre-krfjonjkmvmohb4isfawvp-706739706976.asia-southeast1.run.app'
    ]
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#EA580C',
      sound: 'beep.wav'
    }
  }
};

export default config;

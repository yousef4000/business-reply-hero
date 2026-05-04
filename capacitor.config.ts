import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.smartreplyai',
  appName: 'Smart Reply AI',
  webDir: 'dist',
  // For development: uncomment and set your preview URL
  // server: {
  //   url: 'https://05243de4-ad44-4397-9a3c-854cbccb815d.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#3B82F6',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#3B82F6',
    },
  },
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

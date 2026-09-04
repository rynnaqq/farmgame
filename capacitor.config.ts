import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.rynnaqq.gardenisland',
  appName: 'Garden Island 3D',
  webDir: 'dist',
  // Deep navy backdrop so there is never a white flash on launch/overscroll.
  backgroundColor: '#082f49',
  android: {
    backgroundColor: '#082f49',
  },
  plugins: {
    SplashScreen: {
      // Dismissed programmatically-proof: fixed short show, branded art.
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#082f49',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#082f49',
    },
  },
};

export default config;

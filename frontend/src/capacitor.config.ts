import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vibetune.app',
  appName: 'VibeTune',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#FFFDF5',
      showSpinner: true,
      spinnerColor: '#8686AF'
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#FDEFB2'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark'
    }
  }
};

export default config;
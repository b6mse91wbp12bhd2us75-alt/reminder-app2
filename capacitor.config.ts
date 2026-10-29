const config = {
  appId: 'com.reminder.customalarm',
  appName: 'リマインダー',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      iconColor: '#10B981',
    },
  },
};

export default config;

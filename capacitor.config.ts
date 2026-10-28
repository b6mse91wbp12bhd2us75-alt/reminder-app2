const config = {
  appId: 'com.reminder.customalarm',
  appName: 'リマインダー',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_bell',
      iconColor: '#3182ce',
      sound: 'beep.wav',
    },
  },
};

export default config;

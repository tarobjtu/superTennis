module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets-core 必须放在 reanimated 之前
      ['react-native-worklets-core/plugin'],
    ],
  };
};

module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // If you have reanimated, use this:
      'react-native-reanimated/plugin'
    ]
  };
};
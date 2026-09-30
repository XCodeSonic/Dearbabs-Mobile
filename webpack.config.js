const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: ['@react-native-community/datetimepicker'],
    },
  }, argv);

  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native': 'react-native-web',
  };

  return config;
};
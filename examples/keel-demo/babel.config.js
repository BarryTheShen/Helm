module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          alias: {
            '@keel/protocol': '../../packages/protocol/src',
            '@keel/renderer/presets/paper': '../../packages/renderer/src/presets/paper',
            '@keel/renderer': '../../packages/renderer/src',
          },
        },
      ],
    ],
  };
};

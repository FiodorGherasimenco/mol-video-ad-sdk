/* eslint-disable import/unambiguous, import/no-commonjs, sort-keys, global-require */
const path = require('path');
const baseConfig = require('../../webpack.base.config');
const {name: pkgName} = require('./package.json');

module.exports = {
  ...baseConfig,
  output: {
    devtoolFallbackModuleFilenameTemplate: `webpack:///${pkgName}/[resource-path]?[hash]`,
    devtoolModuleFilenameTemplate: `webpack:///${pkgName}/[resource-path]`,
    path: path.join(__dirname, 'dist'),
    filename: '[name].js',
    library: 'videojsVastVpaid',
    libraryTarget: 'umd',
    umdNamedDefine: true
  }
};

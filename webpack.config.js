var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: './src/app.jsx',
  output: { path: __dirname + '/dist/js', filename: 'app.js' },
  module: {
    loaders: [
      {
        test: /.jsx?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        query: {
          presets: ['es2015', 'react'],
          // plugins: [__dirname + '/build/babelRelayPlugin.js']
        }
      }
    ]
  },
};

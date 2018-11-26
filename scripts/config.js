const path = require('path')
// Convert ES2015 with buble. https://npm.taobao.org/package/rollup-plugin-buble
const buble = require('rollup-plugin-buble')
// Define aliases when bundling packages with Rollup  https://npm.taobao.org/package/rollup-plugin-alias
const alias = require('rollup-plugin-alias')
// Convert CommonJS modules to ES6, so they can be included in a Rollup bundle
const cjs = require('rollup-plugin-commonjs')
// Replace strings in files while bundling them.
const replace = require('rollup-plugin-replace')
// Locate modules using the Node resolution algorithm, for using third party modules in node_modules
const node = require('rollup-plugin-node-resolve')
// 去掉flow使用的类型检查代码
const flow = require('rollup-plugin-flow-no-whitespace')
const version = process.env.VERSION || require('../package.json').version
const weexVersion = process.env.WEEX_VERSION || require('../packages/weex-vue-framework/package.json').version

const banner =
  '/*!\n' +
  ` * Vue.js v${version}\n` +
  ` * (c) 2014-${new Date().getFullYear()} Evan You\n` +
  ' * Released under the MIT License.\n' +
  ' */'

const weexFactoryPlugin = {
  intro () {
    return 'module.exports = function weexFactory (exports, document) {'
  },
  outro () {
    return '}'
  }
}

const aliases = require('./alias')
const resolve = p => {
  // web/entry-runtime.js => web
  const base = p.split('/')[0]
  // {web: resolve('src/platforms/web'}
  if (aliases[base]) {
    // xxxx/xxx/src/platforms/web/ + entry-runtime.js
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    // 从相对路径去获得entry的路径 => 处理dist的情况
    // dist/vue.runtime.common.js 创建新的路径，并输出到文件夹中
    return path.resolve(__dirname, '../', p)
  }
}

const builds = {
  // Runtime only (CommonJS). Used by bundlers e.g. Webpack & Browserify
  'web-runtime-cjs': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.common.js'),
    format: 'cjs',
    banner
  },
  // Runtime+compiler CommonJS build (CommonJS)
  'web-full-cjs': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.common.js'),
    format: 'cjs',
    alias: { he: './entity-decoder' },
    banner
  },
  // Runtime only (ES Modules). Used by bundlers that support ES Modules,
  // e.g. Rollup & Webpack 2
  'web-runtime-esm': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.esm.js'),
    format: 'es',
    banner
  },
  // Runtime+compiler CommonJS build (ES Modules)
  'web-full-esm': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.esm.js'),
    format: 'es',
    alias: { he: './entity-decoder' },
    banner
  },
  // runtime-only build (Browser)
  'web-runtime-dev': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.js'),
    format: 'umd',
    env: 'development',
    banner
  },
  // runtime-only production build (Browser)
  'web-runtime-prod': {
    entry: resolve('web/entry-runtime.js'),
    dest: resolve('dist/vue.runtime.min.js'),
    format: 'umd',
    env: 'production',
    banner
  },
  // Runtime+compiler development build (Browser)
  'web-full-dev': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.js'),
    format: 'umd',
    env: 'development',
    alias: { he: './entity-decoder' },
    banner,
    sourceMap: true
  },
  // Runtime+compiler production build  (Browser)
  'web-full-prod': {
    entry: resolve('web/entry-runtime-with-compiler.js'),
    dest: resolve('dist/vue.min.js'),
    format: 'umd',
    env: 'production',
    alias: { he: './entity-decoder' },
    banner
  },
  // Web compiler (CommonJS).
  'web-compiler': {
    entry: resolve('web/entry-compiler.js'),
    dest: resolve('packages/vue-template-compiler/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-template-compiler/package.json').dependencies)
  },
  // Web compiler (UMD for in-browser use).
  'web-compiler-browser': {
    entry: resolve('web/entry-compiler.js'),
    dest: resolve('packages/vue-template-compiler/browser.js'),
    format: 'umd',
    env: 'development',
    moduleName: 'VueTemplateCompiler',
    plugins: [node(), cjs()]
  },
  // Web server renderer (CommonJS).
  'web-server-renderer': {
    entry: resolve('web/entry-server-renderer.js'),
    dest: resolve('packages/vue-server-renderer/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-basic': {
    entry: resolve('web/entry-server-basic-renderer.js'),
    dest: resolve('packages/vue-server-renderer/basic.js'),
    format: 'umd',
    env: 'development',
    moduleName: 'renderVueComponentToString',
    plugins: [node(), cjs()]
  },
  'web-server-renderer-webpack-server-plugin': {
    entry: resolve('server/webpack-plugin/server.js'),
    dest: resolve('packages/vue-server-renderer/server-plugin.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  'web-server-renderer-webpack-client-plugin': {
    entry: resolve('server/webpack-plugin/client.js'),
    dest: resolve('packages/vue-server-renderer/client-plugin.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/vue-server-renderer/package.json').dependencies)
  },
  // Weex runtime factory
  'weex-factory': {
    weex: true,
    entry: resolve('weex/entry-runtime-factory.js'),
    dest: resolve('packages/weex-vue-framework/factory.js'),
    format: 'cjs',
    plugins: [weexFactoryPlugin]
  },
  // Weex runtime framework (CommonJS).
  'weex-framework': {
    weex: true,
    entry: resolve('weex/entry-framework.js'),
    dest: resolve('packages/weex-vue-framework/index.js'),
    format: 'cjs'
  },
  // Weex compiler (CommonJS). Used by Weex's Webpack loader.
  'weex-compiler': {
    weex: true,
    entry: resolve('weex/entry-compiler.js'),
    dest: resolve('packages/weex-template-compiler/build.js'),
    format: 'cjs',
    external: Object.keys(require('../packages/weex-template-compiler/package.json').dependencies)
  }
}

/**
 * 获取config的名字
 * @param name
 * @returns {{input: *, external: string[] | ExternalOption | * | external | boolean | number | External, plugins: *[], output: {file: (*|string), format: *, banner: (string|BannerPluginArgument|*|AddonHook|(() => (string | Promise<string>))), name: (string|*)}, onwarn: onwarn}}
 */
function genConfig (name) {
  // 'web-full-dev => {}
  const opts = builds[name]
  const config = {
    input: opts.entry,
    external: opts.external,
    plugins: [
      replace({
        __WEEX__: !!opts.weex,
        __WEEX_VERSION__: weexVersion,
        __VERSION__: version
      }),
      flow(),
      buble(), // ES6=> ES5转换
      alias(Object.assign({}, aliases, opts.alias)) //
    ].concat(opts.plugins || []),
    output: {
      file: opts.dest,
      format: opts.format,
      banner: opts.banner,
      name: opts.moduleName || 'Vue',
    },
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg)
      }
    }
  }
  // console.log(config,'replace','\n')
  // console.log(replace({
  //   __WEEX__: !!opts.weex,
  //   __WEEX_VERSION__: weexVersion,
  //   __VERSION__: version
  // }))
  // console.log(flow())

  // { sourceMap: true,
  //   input: 'C:\\Users\\chenlumin\\Desktop\\git\\vue\\src\\platforms\\web\\entry-runtime-with-compiler.js',
  //   external: undefined,
  //   plugins:
  //   [ { name: 'replace', transform: [Function: transform] },
  //   { name: 'flow-remove-types', transform: [Function: transform] },
  //   { name: 'buble', transform: [Function: transform] },
  //   { resolveId: [Function: resolveId] } ],
  //   output:
  //   { file: 'C:\\Users\\chenlumin\\Desktop\\git\\vue\\dist\\vue.js',
  //     format: 'umd',
  //     banner: '/*!\n * Vue.js v2.5.17-beta.0\n * (c) 2014-2018 Evan You\n * Released under the MIT License.\n */',
  //     name: 'Vue' },
  //   onwarn: [Function: onwarn] } 'replace' '\n'
  // { name: 'replace', transform: [Function: transform] }
  // { name: 'flow-remove-types', transform: [Function: transform] }

  if (opts.env) {
    config.plugins.push(replace({
      'process.env.NODE_ENV': JSON.stringify(opts.env)
    }))
  }

  Object.defineProperty(config, '_name', {
    enumerable: false,
    value: name
  })
  // config.__name = web-full-dev

  return config
}

if (process.env.TARGET) {
  // 返回config
  module.exports = genConfig(process.env.TARGET)
} else {
  exports.getBuild = genConfig
  exports.getAllBuilds = () => Object.keys(builds).map(genConfig)
}

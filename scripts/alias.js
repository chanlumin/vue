const path = require('path')

const resolve = p => path.resolve(__dirname, '../', p)

// http://nodejs.cn/api/path.html#path_path_resolve_paths
// resolve 从右往前拼接, 如果拼成一个绝对路径就返回已经拼好的路径
// __dirname 表示当前文件的路径
// console.log(resolve('hello'), __dirname)
module.exports = {
  vue: resolve('src/platforms/web/entry-runtime-with-compiler'),
  compiler: resolve('src/compiler'),
  core: resolve('src/core'),
  shared: resolve('src/shared'),
  web: resolve('src/platforms/web'),
  weex: resolve('src/platforms/weex'),
  server: resolve('src/server'),
  entries: resolve('src/entries'),
  sfc: resolve('src/sfc')
}

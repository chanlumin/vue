/* @flow */

import config from '../config'
import { noop } from 'shared/util'

export let warn = noop
export let tip = noop
export let generateComponentTrace = (noop: any) // work around flow check
export let formatComponentName = (noop: any)

if (process.env.NODE_ENV !== 'production') {
  const hasConsole = typeof console !== 'undefined'
  // 将'aa-bb-cc'转为=>AaBbCc 将连字符转为驼峰，首字母也进转
  const classifyRE = /(?:^|[-_])(\w)/g
  const classify = str => str
    .replace(classifyRE, c => c.toUpperCase())
    .replace(/[-_]/g, '')

  /**
   * 警告函数
   * @param msg
   * @param vm
   */
  warn = (msg, vm) => {
    const trace = vm ? generateComponentTrace(vm) : ''

    // config.warnHandler默认是空
    // 如果自定义警告处理函数的话，执行它
    if (config.warnHandler) {
      config.warnHandler.call(null, msg, vm, trace)
      // config.silent默认是false
      // 警告信息通过console.err输出
    } else if (hasConsole && (!config.silent)) {
      console.error(`[Vue warn]: ${msg}${trace}`)
    }
  }
  /**
   * 提示函数
   * @param msg
   * @param vm
   */
  tip = (msg, vm) => {
    if (hasConsole && (!config.silent)) {
      console.warn(`[Vue tip]: ${msg}` + (
        vm ? generateComponentTrace(vm) : ''
      ))
    }
  }

  formatComponentName = (vm, includeFile) => {
    // 如果vue实例的$root属性等于本身
    if (vm.$root === vm) {
      return '<Root>'
    }
    // 通过new出来的vue实例是一个对象
    // 是'function', 并且有cid直接赋值给options
    // 是Vue实例的话直接通过vm.$options 或者 vm.constructor
    // 不是vm实例的话直接赋值给options 默认是个月对象
    const options = typeof vm === 'function' && vm.cid != null
      ? vm.options
      : vm._isVue
        ? vm.$options || vm.constructor.options
        : vm || {}
    let name = options.name || options._componentTag
    const file = options.__file
    if (!name && file) {
      // 如果name不存在，通过vm.$options.__file获取文件名
      const match = file.match(/([^/\\]+)\.vue$/)
      name = match && match[1]
    }

    // name存在包裹name, name不存在的话, 直接返回在按个file文件中
    return (
      (name ? `<${classify(name)}>` : `<Anonymous>`) +
      (file && includeFile !== false ? ` at ${file}` : '')
    )
  }

  /**
   * 传入字符串, 和重复的次数,返回重复的字符串
   * @param str
   * @param n
   * @returns {string}
   */
  const repeat = (str, n) => {
    let res = ''
    while (n) {
      // 如果是奇数的话 res单独加一次str
      if (n % 2 === 1) res += str
      // 如果是偶数的话 str + str => 加两倍str 然后记性除整
      if (n > 1) str += str
      n >>= 1
    }
    // 返回res
    return res
  }
  // 产生组件回溯信息
  // constructor
  // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Object/constructor
  generateComponentTrace = vm => {
    if (vm._isVue && vm.$parent) {
      const tree = []
      let currentRecursiveSequence = 0
      while (vm) {
        if (tree.length > 0) {
          // 获取最后一个元素
          const last = tree[tree.length - 1]
          // 如果最后一个元素的构造器和vm的构造器相等
          // 如果都是继承于Vue往上回溯
          if (last.constructor === vm.constructor) {
            currentRecursiveSequence++
            vm = vm.$parent
            continue
          } else if (currentRecursiveSequence > 0) {
            //
            tree[tree.length - 1] = [last, currentRecursiveSequence]
            currentRecursiveSequence = 0
          }
        }
        tree.push(vm)
        vm = vm.$parent
      }
      // 输出回溯信息
      return '\n\nfound in\n\n' + tree
        .map((vm, i) => `${
          i === 0 ? '---> ' : repeat(' ', 5 + i * 2)
        }${
          Array.isArray(vm)
            ? `${formatComponentName(vm[0])}... (${vm[1]} recursive calls)`
            : formatComponentName(vm)
        }`)
        .join('\n')
    } else {
      return `\n\n(found in ${formatComponentName(vm)})`
    }
  }
}

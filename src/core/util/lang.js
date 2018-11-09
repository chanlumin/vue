/* @flow */

/**
 * Check if a string starts with $ or _
 */
export function isReserved (str: string): boolean {
  // 转为字符串，获取第一个字符
  // 获取ASCII编码，对比ASCII编码的数值
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5F
}

/**
 * Define a property.
 * 通过Object.defineProperty给对象定义
 * 一个属性
 */
export function def (obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * Parse simple path.
 * 'foo.bar.fu.ba'
 */

// 如果存在字母数字下划线 . 和 $ 符号的话就返回false
//   不存在的话就返回true
const bailRE = /[^\w.$]/

/**
 *  模板中的 属性取值 调用方式如下
 *  const b = parsePath('1123123.123123')
 *  b({'1123123': {
 *     '123123': 'hello'
 *  }})
 * "hello"
 * @param path
 * @returns {function(*=): *}
 */
export function parsePath (path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      // 深度赋值
      obj = obj[segments[i]]
    }
    // 返回比如 xxx.xxx.www 最后的www属性的值
    return obj
  }
}

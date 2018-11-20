/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 * 往arrayMethods添加push,pop,shift, unshift, splice, sort,reverse
 * 调用数组的变异方法的话，数据改变，要通知所有的观察者进行更新操作
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    // 缓存原始数组方法计算结果
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        // unshift(1,2,3) 方法将一个或多个元素添加到数组的开头，并返回该数组的新长度。
        inserted = args
        break
      // var months = ['Jan', 'March', 'April', 'June'];
      // months.splice(1, 0, 'Feb','dssf','a','b','c','d');
      case 'splice':
        // 删除从2开始的位置的数组 返回剩下的数组
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})

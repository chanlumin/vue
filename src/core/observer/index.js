/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

// arrayMethods
// pop: ƒ mutator()
// push: ƒ mutator()
// reverse: ƒ mutator()
// shift: ƒ mutator()
// sort: ƒ mutator()
// splice: ƒ mutator()
// unshift: ƒ mutator()
// __proto__: Array(0)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any;
  dep: Dep;
  vmCount: number; // number of vms that has this object as root $data

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 添加对象属性-> 对象，属性， 属性值
    // var data = {a: 'chanlumin', __ob__: {value: data, dep: dep, vmCount: 0}}
    def(value, '__ob__', this)
    if (Array.isArray(value)) {
      if (hasProto) {
        // 支持__proto__的话 直接把arrayMethods赋值
        // 把arrayMethods赋值给value这个对象
        // target.__proto__ = src
        // console.log(arrayMethods)
        protoAugment(value, arrayMethods)
      } else {
        // 兼容不支持__proto__的浏览器 把arrayMethods中的变异方法
        // 复制到value中去
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 数组的，遍历监听
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  /**
   * Walk through each property and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 遍历对象，将对象的每个属性值编程响应式的
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 * 通过def= Object.defineProperty 给对象添加属性
 *
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 去除VNode和 value
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  // 属性是否已经有了Observer属性
  //
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    // 应该监听 && 非服务端渲染 || 是PlainObject && 可扩展（可以添加属性) && 不是Vue对象
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 给对象添加一个响应式的属性
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  const dep = new Dep()

  // 对象属性不可配置
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 两个删除 取出obj[key] 对应的val值
  const getter = property && property.get
  const setter = property && property.set
  // val 获取到值的条件
  // 如果对象本身自己定义getter那么 取消observe因为
  // 可能用户在getter中自己做一些事情，再经过重新observe
  // getter中的内容就被覆盖掉了。
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }

  // 递归监听值
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          // 给对象添加新属性时候调用
          childOb.dep.depend()
          // data: {arr: [1,2,3] } 数组没法定义get, set  直接添加依赖
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    set: function reactiveSetter (newVal) {
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 第二个条件判断的是原属性是NAN属性值也是NAN的值
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      if (getter && !setter) return
      if (setter) {
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      childOb = !shallow && observe(newVal)
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 *
 * 设置属性或者添加新的属性，如果新的属性不存在的话，添加的时候
 * 触发一个改变的通知。
 * to, key, from
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  // 开发环境的话，提示不能给undefined,null,primitive 设置值
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 数组 并且 isFinite(index) =>  是一个有效的数组下标， 往target添加值，返回添加的值
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    // 通过splice在array.js 定会的方法 触发依赖收集
    target.splice(key, 1, val)
    return val
  }
  // 在target 的原型上不再Object.prototype直接赋值 就能触发响应
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  // 如果target是给Vue对象, 并且监听者存在的话。
  // 不能给根对象和Vue实例进行属性定义
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 监听者不存在的话
  if (!ob) {
    target[key] = val
    return val
  }
  // 添加属性
  defineReactive(ob.value, key, val)
  // 通知
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  // 不能删除reactive的类型
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  // 数组的话 调用splice
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  // observer存在
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  // 存在的话，更新触发更新
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}

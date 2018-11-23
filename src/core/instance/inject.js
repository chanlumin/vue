/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    // 处理provide为function的情况，就执行它
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

export function initInjections (vm: Component) {
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 取消深度监测监测
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

/**
 * 找父类的原型链的inject
 * @param inject
 * @param vm
 * @returns {any}
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    // 获取可以枚举的键值对
    const keys = hasSymbol
      ? Reflect.ownKeys(inject).filter(key => {
        /* istanbul ignore next */
        return Object.getOwnPropertyDescriptor(inject, key).enumerable
      })
      : Object.keys(inject)
    //
    // inject: ['data1', 'data2']
    // {
    //   'data1': { from: 'data1' },
    //   'data2': { from: 'data2' }
    // }
    for (let i = 0; i < keys.length; i++) {
      // 在mergeOption的话 就是from给 inject 添加from属性
      const key = keys[i]
      const provideKey = inject[key].from
      let source = vm
      // 往父类寻找provide
      // source 变量的初始值为当前组件实例对象，在当前对象下找到了通过 provide 选项提供的值
      // 不会给自身注入数据， 因为inject 选项的初始化是在 provide 初始化之前
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      // 到了根部还没找到想要的值，取default值，赋值返回
      if (!source) {
        // 不存在vm 获取inject的default值
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}

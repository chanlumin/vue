/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 * optionMergeStrategies的值默认是Object.create(null)
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    // 如果vm不存在的话, 发出警告， vm不存在的话，它就是子组件
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the ，`new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 * 递归合并两个对象， 返回合并过后的对象
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    // 没有key属性的话设置它
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
      // toVal 和 fromVal对象递归
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 返回函数
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    // const Parent = Vue.extend({
    //   data: function () {
    //     return {
    //       test: 1
    //     }
    //   }
    // })
    //
    // const Child = Parent.extend({})
    // 上述Child类的childVal 不存在, 但是parentVal存在
    // 通过mergeOptions得到paretVal
    // 返回父组件的Data本身
    if (!childVal) {
      return parentVal
    }
    // 返回子组件Data本身
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      console.log(this)
      return mergeData(
        // 返回的data中的第第一个参数是vm实例本身
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {

    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// 处理合并Data选项
// 一、为什么最终 strats.data 会被处理成一个函数？
// 通过函数返回数据对象，保证了每个组件实例都有一个唯一的数据副本，避免了组件间数据互相影响。
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  // 如果是子组件的话, 就没有传递进去vm
  if (!vm) {
    // childVal => data => 如果data 返回的不是一个函数的话
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )
      console.log(parentVal)
      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  // 默认childVal => 是Data中都值
  // console.log(parentVal, childVal,'mergeDataOrFn ...')
  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 *
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  // 最后返一个包裹选项的数组
  return childVal
    ? parentVal
      ? parentVal.concat(childVal)
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
}

LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    // 如果不在dev环境的话 断言一下childVal 给出提示
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

/**
 * Default strategy.
 * 默认的选项合并策略
 * child为空的话，就直接返回parentVal
 * 否则直接返回childVal
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * Validate component names
 * 验证组件名称
 */
function checkComponents (options: Object) {
  // 验证每个组件的子组件的名字
  for (const key in options.components) {
    validateComponentName(key)
  }
}

export function validateComponentName (name: string) {
  if (!/^[a-zA-Z][\w-]*$/.test(name)) {
    // 如果不是以字母开头，以字母数字，下划线结尾的话
    // 警告
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'can only contain alphanumeric characters and the hyphen, ' +
      'and must start with a letter.'
    )
  }
  //  如果是slots, components 或者在配置文件写的保字段的话
  //  警告
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  // console.log(props)
  if (!props) return
  const res = {}
  let i, val, name
  // ["opt"] 如果是数组
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      // 数组的haul
      val = props[i]
      // 数组传递props的话,props也要是string类型。
      if (typeof val === 'string') {
        // 驼峰化
        name = camelize(val)
        // 通过数组传递props的话,type默认是null
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    // 对象
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    // 不是数组不是对象的话
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  // 把optinos.prop传递回去。
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 * inject主要用于获取父组件传递的内容，把父亲组件当做一个store
 */
function normalizeInject (options: Object, vm: ?Component) {
  // 以下为Opitons
  // inject: Array(1), template: "<div>child</div>", name: "child", _Ctor: {…}}
  // inject: {childVal: {…}}
  // name: "child"
  // template: "<div>child</div>"
  // _Ctor: {0: ƒ}
  // __proto__: Object
  // => normazlied => ['childVal': {from: childVal, xxx:xxx}]

  // console.log(options.inject, options)
  const inject = options.inject
  if (!inject) return
  //  normalized 和 options.inject 拥有相同的引用，
  // 修改 normalized 的时候，options.inject 也将受到影响
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
    // console.log(normalized,options.inject, 'normalized')
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
    // console.log(normalized,options.inject, 'normalized')
  } else if (process.env.NODE_ENV !== 'production') {
    // 非生产环境的下提出警告
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  // console.log(dirs)
  // 存在
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      // 如果是函数
      if (typeof def === 'function') {
        // 转化options到对象: => {'test1': {bind: func(){}, update: func()}
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

/**
 * 断言Object类型 不是PlainObject的话 ,警告
 * @param name
 * @param value
 * @param vm
 */
function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  // 非生产环境下的话, 检测一下，子类的components名字的合法性
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options
  }

  // 使用Props的方法
  // const ChildComponent = {
  //   props: ['someData']
  // }
  // 另外一种是使用对象语法：
  //
  // const ChildComponent = {
  //   props: {
  //     someData: {
  //       type: Number,
  //       default: 0
  //     }
  //   }
  // }
  // 在 Vue 中拥有多种使用方法的选项有很多，这给开发者提供了非常灵活且便利的选择，
  // 规范props选项 由多种写法统一到一种写法
  // parent => Vue构造函数, child, Vue的孩子实例, vm
  // console.log(parent, child, vm)
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)
  const extendsFrom = child.extends
  // 如果还有extends属性的话 重新mergeOptinos 此时的child其实就是options中都内容
  // console.log(extendsFrom, child, child.extends,'extendForms')
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
       // 处理options选项中的miixns
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }
  const options = {}
  let key
  // parent option
  for (key in parent) {
    mergeField(key)
  }
  // child option  只传入一个参数, 所以直接把parnet[key]
  // 所得到的值赋值给option
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    //  strat=> 合并选项或者方法的策略
    const strat = strats[key] || defaultStrat
    // 往options中赋值, 赋的值为参数2 或者参数1
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return
  }
  const assets = options[type]
  // check local registration variations first
  if (hasOwn(assets, id)) return assets[id]
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // fallback to prototype chain
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  return res
}

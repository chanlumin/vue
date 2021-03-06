/* @flow */

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  noop
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import type { SimpleSet } from '../util/index'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * 解析表达式， 收集依赖，执行回调函数 当值改变的时候,
 * 在$watch api 和指令集使用
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: SimpleSet;
  newDepIds: SimpleSet;
  before: ?Function;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: ?Object,
    isRenderWatcher?: boolean
  ) {
    this.vm = vm
    // 是否是渲染函数的观察者
    if (isRenderWatcher) {
      vm._watcher = this
    }
    vm._watchers.push(this)
    // options
    if (options) {
      // 获取options中的布尔值
      this.deep = !!options.deep
      this.user = !!options.user // 开发者自定义
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
    } else {
      // 默认是false
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers 计算计算属性的时候 dirty才为真
    // 避免重复收集依赖
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      // 获取对象属性的最后一个值
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 非lazy 执行当前的get, lazy是执行计算属性的一个标志
    this.value = this.lazy
      ? undefined
      : this.get()
  }

  /**
   * Evaluate the getter, and re-collect dependencies.
   */
  get () {
    // 把当前的Watcher赋值个Dep.Target这个全局对象
    // 在getter调用getter之前，添加Watcher到Dep.target上
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 调用parsePath之后的函数，对被观察的目标进行求职
      value = this.getter.call(vm, vm)
    } catch (e) {
      // 用户自定义友好提示
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      // 深度递归监听
      if (this.deep) {
        traverse(value)
      }
      popTarget()
      this.cleanupDeps()
    }
    return value
  }

  /**
   * Add a dependency to this directive.
   * 为指令添加依赖
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      // 收集新的依赖  在一次求值中避免收集重复的观察者 {{name}} {{name}}
      this.newDepIds.add(id)
      this.newDeps.push(dep)

      // 往Dep添加 Watcher
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * Clean up for dependency collection.
   * 清理依赖收集
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      //  dep是上次求值收集到的依赖
      const dep = this.deps[i]
      // 不再新的依赖列表中，观察者和Dep实例对象没有关系了, 把当前的Watcher清除掉
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 交换depIds和清除depIds
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    // 创建一个空的Object.create(null)
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   * 依赖变化 更新策略
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      // 计算属性的标志
      this.dirty = true
      // 同步的话
    } else if (this.sync) {
      this.run()
    } else {
      // 调用栈被清空之后按照一定的顺序执行
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    //
    if (this.active) {
      // 重新求值， 重新执行渲染函数
      const value = this.get()
      // 更新值 执行回调函数
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated. 值改变
        // var data = {obj: {a: 1}};
        // var obj1 = data.obj.a; data.obj1.a = 2
        // var obj2 = data.obj.a;
        // console.log(obj1, obj2)  是对象的话，就要改变
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 这个观察者是开发者自己定义Wacher的话， 自己定义回调函数
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   *  懒watchers的 getter 接口
   */
  evaluate () {
    this.value = this.get()
    // 表示计算属性已经求过值了
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    // 往Dep中添加Watcher,所以的依赖收集都是靠当前的warcher
    //=> this.subs.add(this)
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   *  从所有的依赖任务列表删除当前的订阅列表
   */
  teardown () {
    // active默认是true
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      // 组件没有被销毁的时候  才需要移除（接触属性与观察者之间的关系）
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      // 将观察者实例 从所有的Dep实例中，移除
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}

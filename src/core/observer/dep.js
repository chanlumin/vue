/* @flow */

import type Watcher from './watcher'
// indexOf + splice
import { remove } from '../util/index'
import config from '../config'

let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 * 监听指令的观察者
 */
export default class Dep {
  static target: ?Watcher;
  id: number;
  subs: Array<Watcher>;

  constructor () {
    this.id = uid++
    this.subs = []
  }

  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  removeSub (sub: Watcher) {
    remove(this.subs, sub)
  }

  depend () {
    // target是一个Watcher
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  notify () {
    // stabilize the subscriber list first
    // 复制一份订阅者列表
    const subs = this.subs.slice()
    if (process.env.NODE_ENV !== 'production' && !config.async) {
      // 不是异步的话，subs在任务队列中没有排序， 手动排序
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      subs.sort((a, b) => a.id - b.id)
    }
    // 调用每个订阅者的update
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
//
Dep.target = null
const targetStack = []

export function pushTarget (_target: ?Watcher) {
  // 存在全局对象的话, push, 重新赋值
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

// 把原来的全局对象还回去
export function popTarget () {
  Dep.target = targetStack.pop()
}

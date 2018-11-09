/* @flow */
/* globals MessageChannel */

import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

const callbacks = []
let pending = false

/***
 * 执行callback里面的函数，
 * 重置callback数组
 */
function flushCallbacks () {
  pending = false
  //
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// Here we have async deferring wrappers using both microtasks and (macro) tasks.
// In < 2.4 we used microtasks everywhere, but there are some scenarios where
// microtasks have too high a priority and fire in between supposedly
// sequential events (e.g. #4521, #6690) or even between bubbling of the same
// event (#6566). However, using (macro) tasks everywhere also has subtle problems
// when state is changed right before repaint (e.g. #6813, out-in transitions).
// Here we use microtask by default, but expose a way to force (macro) task when
// needed (e.g. in event handlers attached by v-on).

// 在浏览器环境中，常见的 macro task 有 setTimeout、MessageChannel、postMessage、setImmediate；
// 常见的 micro task 有 MutationObsever 和 Promise.then。
// macro Task执行完了之后 再去执行micro Task
// for (macroTask of macroTaskQueue) {
//     // 1. Handle current MACRO-TASK
//     handleMacroTask();
//
//     // 2. Handle all MICRO-TASK
//     for (microTask of microTaskQueue) {
//         handleMicroTask(microTask);
//     }
// }
let microTimerFunc
let macroTimerFunc
let useMacroTask = false

// Determine (macro) task defer implementation.
// Technically setImmediate should be the ideal choice, but it's only available
// in IE. The only polyfill that consistently queues the callback after all DOM
// events triggered in the same loop is by using MessageChannel.
/* istanbul ignore if */
// 如果是IE浏览器下的话直接执行setImmediate
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
  // 第一个判断是普通浏览器的原生MessageChannel对象
  // 第二个是PhantomJs环境下的MessageChannel对象
  // "function MessageChannel() { [native code] }"
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  // https://developer.mozilla.org/zh-CN/docs/Web/API/MessageChannel
  // 通过MessageChannel 由port2往port1发送message 在接受消息的回调函数处理
  // 函数的调用
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

// Determine microtask defer implementation.
/* istanbul ignore next, $flow-disable-line */
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    // 解决iOS的then问题
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  // microTimer的优雅降级
  microTimerFunc = macroTimerFunc
}

/**
 * Wrap a function so that if any code inside triggers state change,
 * the changes are queued using a (macro) task instead of a microtask.
 * 装饰一个函数 如果代码触发state改变的话，
 * 这些改变会用macro task去改变，而不是用microtask去改变
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    const res = fn.apply(null, arguments)
    useMacroTask = false
    return res
  })
}

export function nextTick (cb?: Function, ctx?: Object) {
  let _resolve
  // push一个包裹回调函数的函数到callbacks 并执行
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  if (!pending) {
    pending = true
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  // $flow-disable-line
  // nextTick不提供cb的话, 提供_resolve
  // 让你有机会重新为回调函数进行赋值,通过返回的promise在then
  // 里面加一个回调函数
  // 就会把then里面的回调函数
  // 赋值给_resolve
  // flushCallbacks的时候就能够执行_resolve的函数
  //
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}

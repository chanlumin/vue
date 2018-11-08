import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

// Vue构造函数
function Vue (options) {
  //  不是生产阶段，并且不是通new 来产生实例的话 警告
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)



import {makeMap, camelize, hyphenate} from "../../shared/util";
// 添加测试代码
Vue._makeMap = makeMap
Vue._camelize = camelize
Vue._hyphenate = hyphenate

export default Vue

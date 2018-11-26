/* @flow */

import {
  isPreTag,
  mustUseProp,
  isReservedTag,
  getTagNamespace
} from '../util/index'

import modules from './modules/index'
import directives from './directives/index'
import { genStaticKeys } from 'shared/util'
import { isUnaryTag, canBeLeftOpenTag } from './util'

export const baseOptions: CompilerOptions = {
  expectHTML: true,
  modules,
  directives,
  isPreTag, // 是否是<pre> 标签
  isUnaryTag, // 是否是元标签
  mustUseProp, // 是否需要用props进行绑定
  canBeLeftOpenTag, // 可以自闭合的标签 比如<p>哈哈哈哈 浏览器会自动进行补全
  isReservedTag, // 否是是保留标签
  getTagNamespace, // 获取元素标签的命名空间
  staticKeys: genStaticKeys(modules) // 萃取staticKeys
}

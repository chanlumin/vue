/* @flow */

import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  pluckModuleFunction
} from '../helpers'
// 匹配@或者v-on:
export const onRE = /^@|^v-on:/
// 匹配v- 或者@ 或者:
export const dirRE = /^v-|^@|^:/
// 匹配 item in items 或者 item of  items  \s\S空白字符串和非空白字符串 匹配
export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
// 匹配 ,dfsdfk,dsdfds ?
// value,key,index => ,key,index key index  || value, index => ,index index
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
// 匹配以(开头 或者以)结尾的字符串 全局匹配
const stripParensRE = /^\(|\)$/g
// 匹配:hello
const argRE = /:(.*)$/
//  :或者v-bind
export const bindRE = /^:|^v-bind:/
// 匹配 .hello
// const matchs = 'v-on:click.stop'.match(modifierRE)
const modifierRE = /\.[^.]+/g

// console.log(he.decode('&#x26;'))  // &#x26; -> '&'
// he用于解析实体字符
const decodeHTMLCached = cached(he.decode)

// configurable state
// 平台化的选项变量
export let warn: any
let delimiters
let transforms
let preTransforms
let postTransforms
let platformIsPreTag
let platformMustUseProp
let platformGetTagNamespace

type Attr = { name: string; value: string };

// 创建AST的基本数据结构
export function createASTElement (
  tag: string,
  attrs: Array<Attr>,
  parent: ASTElement | void
): ASTElement {
  return {
    type: 1,
    tag,
    attrsList: attrs,
    attrsMap: makeAttrsMap(attrs),
    parent,
    children: []
  }
}

/**
 * Convert HTML string to AST.
 */
export function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  // 警告
  warn = options.warn || baseWarn
  // 是否是<pre>标签
  platformIsPreTag = options.isPreTag || no
  // 使用元素对象原生的 prop 进行绑定， 这里的 prop 指的是元素对象属性
  platformMustUseProp = options.mustUseProp || no
  // 获取元素(标签)的命名空间
  platformGetTagNamespace = options.getTagNamespace || no

  transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  // 创建 Vue 实例对象时传递的delimiters
  delimiters = options.delimiters

  const stack = []
  // 在编译 html字符串时是否放弃标签之间的空格 true代表放弃
  const preserveWhitespace = options.preserveWhitespace !== false
  let root
  let currentParent
  // 是否在有v-pre属性的标签中
  let inVPre = false
  // 是否在 pre
  let inPre = false
  let warned = false

  // 警告只调用一次
  function warnOnce (msg) {
    if (!warned) {
      warned = true
      warn(msg)
    }
  }

    function closeElement (element) {
      // check pre state
      if (element.pre) {
        inVPre = false
      }
      // <pre>
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // apply post-transforms
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    start (tag, attrs, unary) {
      // check namespace.
      // inherit parent ns if there is one
      // 获取当前的命名空间 比如 <svg><rect></rect></svg> => 获取到的命名空间都是svg
      // rect得到的命名就是svg
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      // <svg xmlns:feature="http://www.openplans.org/topp"></svg> IE下回渲染成
      // <svg xmlns:NS1="" NS1:xmlns:feature="http://www.openplans.org/topp"></svg>
      // 处理IE渲染的属性异常
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }
      //  根Root
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      // element = {
      //   type: 1,
      //   tag: 'div',
      //   attrsList: [
      //     {
      //       name: 'v-for',
      //       value: 'obj of list'
      //     },
      //     {
      //       name: 'class',
      //       value: 'box'
      //     }
      //   ],
      //   attrsMap: makeAttrsMap(attrs),
      //   parent,
      //   children: []
      // }
      // namespace
      if (ns) {
        element.ns = ns
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        // 添加给禁止元素添加tag
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.'
        )
      }

      // apply pre-transforms
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {

        // v-pre 不需要传递属性值 用来跳过编译当前元素节点及其自子节点
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      // 当前的标签是<pre>
      // 1、<pre> 标签会对其所包含的 html 字符实体进行解码
      // 2、<pre> 标签会保留 html 字符串编写时的空白
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
        // 元素还没有被解析过的话
      } else if (!element.processed) {
        // structural directives
        processFor(element)
        processIf(element)
        processOnce(element)
        // element-scope stuff
        processElement(element, options)
      }

      // 根节点限制
      function checkRootConstraints (el) {
        if (process.env.NODE_ENV !== 'production') {
          if (el.tag === 'slot' || el.tag === 'template') {
            // 根节点不能为slot或者template
            // slot和template可能包括多个不同的 元素节点
            warnOnce(
              `Cannot use <${el.tag}> as component root element because it may ` +
              'contain multiple nodes.'
            )
          }
          // 根节点不能有v-for, 因为v-for一般渲染多个节点
          if (el.attrsMap.hasOwnProperty('v-for')) {
            // 每次只提供提供一个警告给开发者, 避免开发者迷惑
            warnOnce(
              'Cannot use v-for on stateful component root element because ' +
              'it renders multiple elements.'
            )
          }
        }
      }

      // tree management
      // 不存在父亲节点
      if (!root) {
        root = element
        checkRootConstraints(root)
      } else if (!stack.length) {
        // allow root elements with v-if, v-else-if and v-else
        // element 当前元素
        if (root.if && (element.elseif || element.else)) {
          checkRootConstraints(element)
          // 如果碰到v-if这个根节点的话
          // 把它的子节点的所以elseif else条件表达式都放进if-condition中
          // {
          //   type: 1,
          //     tag: 'div',
          //   ifConditions: [
          //   {
          //     exp: 'b',
          //     block: { type: 1, tag: 'p' /* 省略其他属性 */ }
          //   },
          //   {
          //     exp: undefined,
          //     block: { type: 1, tag: 'span' /* 省略其他属性 */ }
          //   }
          // ]}
          addIfCondition(root, {
            exp: element.elseif,
            block: element
          })
        } else if (process.env.NODE_ENV !== 'production') {

          warnOnce(
            `Component template should contain exactly one root element. ` +
            `If you are using v-if on multiple elements, ` +
            `use v-else-if to chain them instead.`
          )
        }
      }
      // 如果当前的父亲节点纯在
      if (currentParent && !element.forbidden) {
        if (element.elseif || element.else) {
          // 标签使用v-else-if或者v.else的话 把当前的标签添加到
          // 前面的元素的ifConditions中
          processIfConditions(element, currentParent)
        } else if (element.slotScope) { // scoped slot
          // 添加到父亲节点的scopedSlots中
          currentParent.plain = false
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[name] = element
        } else {
          // push进去父节点
          currentParent.children.push(element)
          element.parent = currentParent
        }
      }
      // 不是一元标签的话 当前的element赋值给currentParent
      if (!unary) {
        currentParent = element
        // 用来回退根节点
        stack.push(element)
      } else {
        // 一元标签
        closeElement(element)
      }
    },

    end () {
      // remove trailing whitespace
      const element = stack[stack.length - 1]
      const lastNode = element.children[element.children.length - 1]
      if (lastNode && lastNode.type === 3 && lastNode.text === ' ' && !inPre) {
        element.children.pop()
      }
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      // 一元标签或非一元标签的结束标签时会调用 closeElement
      closeElement(element)
    },

    chars (text: string) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.'
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      // IE的bug textarea的placeholder中的文本会被渲染到innerHTML中
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      // 文本节点需要Decode 因为Vue用的是createTextNode
      text = inPre || text.trim()
        ? isTextTag(currentParent) ? text : decodeHTMLCached(text)
        // only preserve whitespace if its not right after a starting tag
        : preserveWhitespace && children.length ? ' ' : ''
      if (text) {
        let res
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          // 含有表达式
          // <div>我的名字是：{{ name }}</div>
          children.push({
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          })
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          children.push({
            type: 3,
            text
          })
        }
      }
    },
    // 注释节点添加一个type为3的Object
    comment (text: string) {
      currentParent.children.push({
        type: 3,
        text,
        isComment: true
      })
    }
  })
  return root
}

function processPre (el) {
  // el = {
  //   type: 1,
  //   tag,
  //   attrsList: attrs,
  //   attrsMap: makeAttrsMap(attrs),
  //   parent,
  //   children: [],
  //   pre: true
  // }
  // v-pre属性值 不需要添加属性值 所以getAndRemoveAttr(el, 'v-pre') => val = '' 所以成立
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

// <div @click='hi' v-pre></div>
// 成立v-pre指令的元素
function processRawAttrs (el) {
  const l = el.attrsList.length
  if (l) {
    const attrs = el.attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      attrs[i] = {
        name: el.attrsList[i].name,
        // 保证始终作为字符串来处理
        value: JSON.stringify(el.attrsList[i].value)
      }
    }
  } else if (!el.pre) {
    //<div v-pre>
    //  <span></span>
    //</div>
    // span节点添加plain节点
    // non root node in pre blocks with no attributes
    el.plain = true
  }
}

export function processElement (element: ASTElement, options: CompilerOptions) {
  processKey(element)

  // determine whether this is a plain element after
  // removing structural attributes
  // 标记纯元素
  element.plain = !element.key && !element.attrsList.length

  processRef(element)
  processSlot(element)
  processComponent(element)
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }
  processAttrs(element)
}

function processKey (el) {
  //  <div key="id"></div>
  // 普通属性
  //   el.key = JSON.stringify('id')
  //   <div :key="id"></div>
  //   绑定属性 el.key
  //   el.key = 'id'
  //   <div :key="id | featId"></div>
  //   绑定属性加过滤器: el.key 属性的值为：
  //   el.key = '_f("featId")(id)'
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    // 获取属性值 key对应的表达式 其中 template不能 打上key这个Tag
    if (process.env.NODE_ENV !== 'production' && el.tag === 'template') {
      warn(`<template> cannot be keyed. Place the key on real elements instead.`)
    }
    // 给e添加 key对应的属性值的Tag
    el.key = exp
  }
}

function processRef (el) {
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    el.ref = ref
    el.refInFor = checkInFor(el)
  }
}

export function processFor (el: ASTElement) {
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    const res = parseFor(exp)
    if (res) {
      extend(el, res)
    } else if (process.env.NODE_ENV !== 'production') {
      warn(
        `Invalid v-for expression: ${exp}`
      )
    }
  }
}

type ForParseResult = {
  for: string;
  alias: string;
  iterator1?: string;
  iterator2?: string;
};

// (obj, key, index) in list
// {
//   for: 'list',
//   alias: 'obj',
//   iterator1: 'key',
//   iterator2: 'index'
// }

export function parseFor (exp: string): ?ForParseResult {
  // 匹配 item in items 或者 item of  items  \s\S空白字符串和非空白字符串 匹配
  // export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
  // 'item in items'.match(forAliasRE)
  // ["item in items", "item", "items", index: 0, input: "item in items", groups: undefined]
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return
  const res = {}
  res.for = inMatch[2].trim()
  // '(item,index) in items' => item,index
  const alias = inMatch[1].trim().replace(stripParensRE, '')
  // => ,index or  ,key, index
  const iteratorMatch = alias.match(forIteratorRE)
  if (iteratorMatch) {
    // value key index  key index
    res.alias = alias.replace(forIteratorRE, '').trim()
    res.iterator1 = iteratorMatch[1].trim()
    if (iteratorMatch[2]) {
      res.iterator2 = iteratorMatch[2].trim()
    }
  } else {
    res.alias = alias
  }
  return res
}

function processIf (el) {
  // 给元素节点添加if || elseif || else tag
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

function processIfConditions (el, parent) {
  const prev = findPrevElement(parent.children)
  // 前一一节点有if Tag的话 把当前节点添加到el.ifCondifitions数组中
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (process.env.NODE_ENV !== 'production') {
    // 没有配套的v-if 给出友情提示。
    warn(
      `v-${el.elseif ? ('else-if="' + el.elseif + '"') : 'else'} ` +
      `used on element <${el.tag}> without corresponding v-if.`
    )
  }
}
// <span></span>
// <ul>
//    <li>x</li>
//    <li>y</li>
// </ul>
function findPrevElement (children: Array<any>): ASTElement | void {
  let i = children.length
  // Parent.children
  while (i--) {
    //<div>
    //   <div v-if="a"></div>
    //   aaaaa
    //   <p v-else-if="b"></p>
    //   bbbbb
    //   <span v-else="c"></span>
    // </div>
    // 当前元素还没被添加到父亲的children数组中
    // 所以它的前一个元素节点是<div v-if="a"></div>
    // 只需要从后往前遍历，然后去除非元素节点
    // 找到元素节点返回即可。
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (process.env.NODE_ENV !== 'production' && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
          `will be ignored.`
        )
      }
      // 去除非元素节点
      children.pop()
    }
  }
}
// 添加ifConditions条件数组
export function addIfCondition (el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

// 获取v-once并且做Tag标记。
// 删除attrList中的v-once字段
function processOnce (el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

function processSlot (el) {
  if (el.tag === 'slot') {
  // <slot></slot>
  // <slot name="slot"></slot>
    el.slotName = getBindingAttr(el, 'name')
      // <slot> 标签和 <template> 抽象组件，
    // 抽象组件的不渲染真实DOM，可能会被不可预知的DOM元素替代
    if (process.env.NODE_ENV !== 'production' && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
        `and can possibly expand into multiple elements. ` +
        `Use the key on a wrapping element instead.`
      )
    }
  } else {
    // scope 属性和 slot-scope
    let slotScope
    if (el.tag === 'template') {
      slotScope = getAndRemoveAttr(el, 'scope')
      // 生产环境提示scope已经废弃, 用slot-scope替换
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && slotScope) {
        warn(
          `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
          true
        )
      }
      el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
    } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
      /* istanbul ignore if */
      // 提示 不要将slot-scope和 v-for合在一起用。
      if (process.env.NODE_ENV !== 'production' && el.attrsMap['v-for']) {
        warn(
          `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
          `(v-for takes higher priority). Use a wrapper <template> for the ` +
          `scoped slot to make it clearer.`,
          true
        )
      }
      el.slotScope = slotScope
    }
    const slotTarget = getBindingAttr(el, 'slot')
    if (slotTarget) {
      // <div slot></div> =>获取到的slot是""
      el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
      // preserve slot as an attribute for native shadow DOM compat
      // only for non-scoped slots.
      // 保留原生影子插槽 => 所以才会更换为slot-scope
      if (el.tag !== 'template' && !el.slotScope) {
        addAttr(el, 'slot', slotTarget)
      }
    }
  }
}

// 处理Component
// <div is></div> => el.component = ''
function processComponent (el) {
  let binding
  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

function processAttrs (el) {
  const list = el.attrsList
  // 因为processFor已经处理for并且把它移除掉了
  // 所以在这里已经剩下attrs了
  let i, l, name, rawName, value, modifiers, isProp
  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    // export const dirRE = /^v-|^@|^:/
    if (dirRE.test(name)) {
      // mark element as dynamic
      el.hasBindings = true
      // modifiers
      modifiers = parseModifiers(name)
      if (modifiers) {
        // 删除.xxx
        name = name.replace(modifierRE, '')
      }
      // export const bindRE = /^:|^v-bind:/
      if (bindRE.test(name)) { // v-bind
        // 绑定的话就不能当做Props来处理了
        name = name.replace(bindRE, '')
        value = parseFilters(value)
        isProp = false
        if (
          process.env.NODE_ENV !== 'production' &&
          value.trim().length === 0
        ) {
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
          )
        }
        if (modifiers) {
          if (modifiers.prop) {
            isProp = true
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          // vue主动去获取浏览器的模板的时候才会
          // 浏览器渲染属性的时候会把属性转成小写的 所以Vue一开始去获取的
          // 属性是小写的 :viewbox="viewBox" 的时候，属性修饰 转换为大写
          // <svg :viewBox="viewBox"></svg>
          // <svg :viewbox="viewBox"></svg>'
          if (modifiers.camel) {
            name = camelize(name)
          }
          // <child :some-prop.sync="value" />
        //   <template>
        //     <child :some-prop="value" @update:someProp="handleEvent" />
        //  </template>
          if (modifiers.sync) {
            addHandler(
              el,
              `update:${camelize(name)}`,
              genAssignmentCode(value, `$event`) // 返回一个字符串
            )
          }
        }
        // isProp 该属性绑定的原生的属性
        if (isProp || (
          // 没有使用is属性
          // input,textarea,option,select,progress标签的 value 属性使用原生 prop 绑定（除了 type === 'button' 之外）
          // 函数在判断的时候需要标签的名字(el.tag)，而 el.component 会在元素渲染阶段替换掉 el.tag 的值
          !el.component && platformMustUseProp(el.tag, el.attrsMap.type, name)
        )) {
          addProp(el, name, value)
        } else {
          addAttr(el, name, value)
        }
      } else if (onRE.test(name)) { // v-on
        name = name.replace(onRE, '')
        addHandler(el, name, value, modifiers, false, warn)
      } else { // normal directives
        // v- || @ || :
        name = name.replace(dirRE, '')
        // parse arg
        const argMatch = name.match(argRE)
        const arg = argMatch && argMatch[1]
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
        }
        // el.directives = [
        //   {
        //     name, // 指令名字
        //     rawName, // 指令原始名字
        //     value, // 指令的属性值
        //     arg, // 指令的参数
        //     modifiers // 指令的修饰符
        //   }
        // ]
        addDirective(el, name, rawName, value, arg, modifiers)
        if (process.env.NODE_ENV !== 'production' && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // literal attribute
      if (process.env.NODE_ENV !== 'production') {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
            'Interpolation inside attributes has been removed. ' +
            'Use v-bind or the colon shorthand instead. For example, ' +
            'instead of <div id="{{ val }}">, use <div :id="val">.'
          )
        }
      }
      addAttr(el, name, JSON.stringify(value))
      // #6887 firefox doesn't update muted state if set via attribute
      // even immediately after element creation
      // 解决firefox的bug 添加到prop并且把prop
      if (!el.component &&
          name === 'muted' &&
          platformMustUseProp(el.tag, el.attrsMap.type, name)) {
        addProp(el, name, 'true')
      }
    }
  }
}

// 从当前的组件开始查找， 如果有for标签 代表当前的组件在v-for里面
function checkInFor (el: ASTElement): boolean {
  let parent = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

// ':click.stop.hello.dfs'.match(modifierRE)
// [".stop",".hello",".dfs"]
// 返回修饰对象
function parseModifiers (name: string): Object | void {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => { ret[m.slice(1)] = true })
    return ret
  }
}
// {
//  'prev': '1000',
//  'next': '2000',
// }
// 返回一个Map
function makeAttrsMap (attrs: Array<Object>): Object {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (
      process.env.NODE_ENV !== 'production' &&
      map[attrs[i].name] && !isIE && !isEdge
    ) {
      warn('duplicate attribute: ' + attrs[i].name)
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
function isTextTag (el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

// 禁止的Tag 包括style script&&  el.attrsMap不存在或者el.attrsMap.type 等于text/javascript
// <script></script>
// <script type="text/javascript"> </script>
// 上面两种标签都是被禁止的
function isForbiddenTag (el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' && (
      !el.attrsMap.type ||
      el.attrsMap.type === 'text/javascript'
    ))
  )
}

const ieNSBug = /^xmlns:NS\d+/
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
// attrs = [
//   {
//     name: 'xmlns:NS1',
//     value: ''
//   },
//   {
//     name: 'NS1:xmlns:feature',
//     value: 'http://www.openplans.org/topp'
//   }
// ]
function guardIESVGBug (attrs) {
  const res = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    // 不是xmlns:NS1的haul 直接替换NS1
    // 如果是xmlns:NS1的话
    // 没有任何动作 =>去除
    if (!ieNSBug.test(attr.name)) {
      // 去掉NS1:这个字符串
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

// v-for="item in items"
// v-model=item
// 以下为正确使用v-model的姿势
// <div v-for="obj of list">
//   <input v-model="obj.item" />
// </div>
function checkForAliasModel (el, value) {
  let _el = el
  while (_el) {
    //  el.for 并且 el.alias等于value
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
        `You are binding v-model directly to a v-for iteration alias. ` +
        `This will not be able to modify the v-for source array because ` +
        `writing to the alias is like modifying a function local variable. ` +
        `Consider using an array of objects and use v-model on an object property instead.`
      )
    }
    _el = _el.parent
  }
}

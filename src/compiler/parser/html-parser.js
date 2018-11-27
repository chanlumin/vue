/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// Regular Expressions for parsing tags and attributes
// 匹配如右四种字符串 class="class"   class='class'  class=class   disabled ?:不捕获
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
// 的XML标签名应该是由 前缀、冒号(:) 以及 标签名称 组成的：<前缀:标签名称>
// <k:bug xmlns:k="http://www.xxx.com/xxx"></k:bug>
// ncname 的全称是 An XML name that does not contain a colon (:)
// 双\\ 表示\直接对 \ 进行转义
// 第二个匹配[字母下划线-.]
const ncname = '[a-zA-Z_][\\w\\-\\.]*'

// k:hello  =>  qname匹配合法的XML标签
const qnameCapture = `((?:${ncname}\\:)?${ncname})`

// 匹配 <k:hello
const startTagOpen = new RegExp(`^<${qnameCapture}`)
// 匹配 > 或者/> 问号表示出现的次数是0或者1次
const startTagClose = /^\s*(\/?)>/
// 匹配</k:hello>
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
// 撇皮<!DOCTYPE htmlxxx>  不区分大小写
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being pased as HTML comment when inlined in page
// 匹配 <!--
// <!\--为了把Vue代码内联到html，所以加了个小转义。否则 <!-- 会被认为是注释节点
const comment = /^<!\--/
// 匹配<![
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
// 是否是script style textarea 纯文本标签
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

// 实体和字符串
const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t'
}
// 匹配 &lt;、&gt;、&quot;、&amp;
const encodedAttr = /&(?:lt|gt|quot|amp);/g
// &lt || &gt || &quot || &amp || &#10 || &#9
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10|#9);/g

// #5992
// 标签是 pre 或者 textarea 且 标签内容的第一个字符是换行符，则返回 true，否则为 false
// 浏览器在实现textarea的时候 会忽略第一个换行符
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
// pre和textarea应该忽略第一个换行符
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

// 解析属性值
function decodeAttr (value, shouldDecodeNewlines) {
  // encodeAttrWithNewLines多了两个属性
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  // 初始化 返回no 始终返回
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  // lastTag保存着栈顶的元素
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // 没有拿到的栈顶的非一元标签的开始标签 也不是纯文本内容标签元素 比如 script/style的haul
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            // 处理注释文本
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd))
            }
            // 指针移动到去除注释节点之后的位置
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 处理条件注释节点 <! [ ]>
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag: </a:bbbb>  </ddd>
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        // html = '0<1<2'  textEnd = 1
        rest = html.slice(textEnd)
        //
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          // rest =  <1<2  => next = 2
          next = rest.indexOf('<', 1)

          if (next < 0) break
          // textEnd = 3
          textEnd += next
          // <2
          rest = html.slice(textEnd)
        }
        // text => 0<1
        text = html.substring(0, textEnd)
        advance(textEnd)
      }
      // 将整个文本作为字符串处理
      if (textEnd < 0) {
        text = html
        html = ''
      }
      // 被当成纯文本处理
      if (options.chars && text) {
        options.chars(text)
      }
    } else {
      // 在纯文本标签里
      // 保存纯文本标签闭合标签的字符长度
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      // reStackedTag 的作用是用来匹配纯文本标签的内容以及结束标签
      // *? 懒惰模式 只要第二个分组匹配成功停止匹配
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        // all => 整个文本标签  text 匹配的文本 endTag 结束的标签
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298 <! -- 空格字符串+非空格字符串 -->
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1') // <! [CDATA[dsfasdf]]>
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      // rest 剩余的文本标签
      index += html.length - rest.length
      html = rest
      //parseEndTag 函数解析纯文本标签的结束标签
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    // 一次循环后 文本标签没有变化 => 把html当做纯字符串
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    // 匹配  <k:hello 或 <hello
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      // startTagClose 要求以空格 或者以  / 或者以>开头的 所以不是结尾标签
      // 匹配属性
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {
        // unary 一元的 / 比如 <br/> 匹配到 [/>, /]
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        // attrs: [Array(6)]
        // end: 14
        // start: 0
        // tagName: "div"
        // unarySlash: ""
        return match
      }
    }
  }

  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 第二个判断 是否包含 / 标签  <my-component />
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // 0: " id="app""
      // 1: "id"
      // 2: "="
      // 3: "app"
      // 4: undefined
      // 5: undefined
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
    }
    // 非一元标签  把tag push进去栈顶
    // lastTag保持非一元标签的最新引用
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    // 知道栈中与tag标签最相近的位置 pos
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }
    // 没有提Tag name的话
    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          // 闭合一元缺失标签
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
    // </br> 和 </p> 标签浏览器可以将其正常解析为 <br> 以及 <p></p>，而对于 </div> 浏览器会将其忽略
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      // 处理P标签
      // options.start
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}

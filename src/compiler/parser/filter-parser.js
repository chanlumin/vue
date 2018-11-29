/* @flow */

const validDivisionCharRE = /[\w).+\-_$\]]/

// 解析动态绑定表达式
export function parseFilters (exp: string): string {
  // 在单引号内
  let inSingle = false
  // 双引号内
  let inDouble = false
  // 模板字符串
  let inTemplateString = false
  // 正则内
  let inRegex = false
  // 花括号 遇左括加1， 右花括号减一
  // <div :key="(aa | bb)"></div> 如果有一个变量不为0的话 证明存在(
  // 此时 | 不应被作为过滤器
  let curly = 0
  // 方括号
  let square = 0
  // 圆括号
  let paren = 0
  // 用来确定过滤器的位置
  let lastFilterIndex = 0
  // expression  parseFilters 函数的返回值
  // filters 数组 保存所有过滤器函数名
  let c, prev, i, expression, filters

  for (i = 0; i < exp.length; i++) {
    prev = c
    c = exp.charCodeAt(i)
    if (inSingle) {
      // ' \
      // 第二个遇到单引号 并且它的前面不是'\'的话 表示已经跳出单引号了
      if (c === 0x27 && prev !== 0x5C) inSingle = false
    } else if (inDouble) {
      // " \
      if (c === 0x22 && prev !== 0x5C) inDouble = false
    } else if (inTemplateString) {
      // ` \
      if (c === 0x60 && prev !== 0x5C) inTemplateString = false
    } else if (inRegex) {
      // / \
      if (c === 0x2f && prev !== 0x5C) inRegex = false
    } else if (
      // |
      c === 0x7C && // pipe   0x7C => |
      exp.charCodeAt(i + 1) !== 0x7C &&
      exp.charCodeAt(i - 1) !== 0x7C &&
      !curly && !square && !paren
    ) {
      // 管道 |  前面非|后面非|  不再() [] {} 中
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        expression = exp.slice(0, i).trim()
      } else {
        pushFilter()
      }
    } else {
      // <div :key="'id'"> </div>
      // 第一次读取的字符串
      switch (c) {
        case 0x22: inDouble = true; break         // "
        case 0x27: inSingle = true; break         // '
        case 0x60: inTemplateString = true; break // `
        case 0x28: paren++; break                 // (
        case 0x29: paren--; break                 // )
        case 0x5B: square++; break                // [
        case 0x5D: square--; break                // ]
        case 0x7B: curly++; break                 // {
        case 0x7D: curly--; break                 // }
      }
      // 双引号
      if (c === 0x2f) { // /
      // <div :key="/a/.test('abc')"></div>      <!-- 第一个 `/` 之前就没有字符  -->
      // <div :key="    /a/.test('abc')"></div>  <!-- 第一个 `/` 之前都是空格  -->
        // 缓存前一个字符
        let j = i - 1
        let p
        // 找到/前一个字符
        // find first non-whitespace prev char
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        // 前一个字符为空 或者 没有出现在  /[\w).+\-_$\]]/ 这些字符里面代表在正则里面
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }
  // <div :key="id | featId"></div>
  if (expression === undefined) {
    // 初始化截取 :key
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    pushFilter()
  }

  function pushFilter () {
    // 第二次截取 <div :filter="id|name|hello"> </div>
    (filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    lastFilterIndex = i + 1
  }
  // expression=id filters = [name, hello]
  if (filters) {
    for (i = 0; i < filters.length; i++) {
      expression = wrapFilter(expression, filters[i])
      // _f("hello")(_f("name")('id'))
    }
  }

  return expression
}

function wrapFilter (exp: string, filter: string): string {
  const i = filter.indexOf('(')
  if (i < 0) {
    // _f: resolveFilter
    return `_f("${filter}")(${exp})`
  } else {
    const name = filter.slice(0, i)
    const args = filter.slice(i + 1)
    return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
  }
}

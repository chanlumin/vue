/* @flow */

import { inBrowser } from 'core/util/env'
import { makeMap } from 'shared/util'

export const namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
}

export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
// 不区分大小写
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)

// 是否是 'pre' 这个标签名字
export const isPreTag = (tag: ?string): boolean => tag === 'pre'

// 是否是保留的标签 包括 html 标签和svg标签
export const isReservedTag = (tag: string): ?boolean => {
  return isHTMLTag(tag) || isSVG(tag)
}

// 获取Tag的命名空间 也就是根空间
export function getTagNamespace (tag: string): ?string {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}

// 不知道的元素的缓存, 用对象作为缓存器
const unknownElementCache = Object.create(null)
export function isUnknownElement (tag: string): boolean {
  /* istanbul ignore if */
  // 非浏览器环境下 都是不知道的标签，不用进行处理
  if (!inBrowser) {
    return true
  }
  // 是保留标签的话 返回不用处理
  if (isReservedTag(tag)) {
    return false
  }
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  // 缓存对象中包含非保留标签，直接返回属性值
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  const el = document.createElement(tag)
  // var c = document.createElement('g-a-d');c.toString()
  // "[object HTMLElement]"
  if (tag.indexOf('-') > -1) {
    // http://stackoverflow.com/a/28210364/1070244
    // 如果是 'a-b-c' 这样的标签 用浏览器下不会是HTMLUnknownElement 所以用以下判断
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  } else {
    // var b  = document.createElement('dfs')；b.toString()
    // "[object HTMLUnknownElement]"
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}

// textInputType的Map标签
export const isTextInputType = makeMap('text,number,password,search,email,tel,url')

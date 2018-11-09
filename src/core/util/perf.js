import { inBrowser } from './env'

export let mark
export let measure

// mark('for-start')
// for (let i = 0; i < 100; i++) {
//   console.log(i)
// }
// mark('for-end')
// measure('for-measure', 'for-start', 'for-end')
// https://developer.mozilla.org/zh-CN/docs/Web/API/Performance

if (process.env.NODE_ENV !== 'production') {
  const perf = inBrowser && window.performance
  /* istanbul ignore if */
  if (
    perf &&
    perf.mark &&
    perf.measure &&
    perf.clearMarks &&
    perf.clearMeasures
  ) {
    mark = tag => perf.mark(tag)
    measure = (name, startTag, endTag) => {
      // measure完之后, 清除标志
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      perf.clearMeasures(name)
    }
  }
}

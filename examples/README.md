### Observer
1. 属性收集了渲染函数的观察者， 比如name收集一个Watcher


### nextTick 
1. microTask 会在UI渲染之前把数据全部都更新，执行优先于macroTask
2. macroTask setTimeout会把任务都放到macroTask中。

### let b =  Object.create({name: 'clm', greeting: function(words) {console.log(words)})
> 产生的新对象挂在b.__proto__中,不是b.prototype
b.name === 'clm'
b.__proto__.name === 'clm'


### html-parser ==> http://erik.eae.net/simplehtmlparser/simplehtmlparser.js


### 小技巧 去除undefined 或者 null值
['1', undefined, null].filter(_=>_)


### JSON.stringfy的用处
```javascript
const fn1 = new Function('console.log(1)')
const fn2 = new Function(JSON.stringify('console.log(1)'))
// fn1 和 fn2，它们的区别在于 fn2 的参数使用了 JSON.stringify，
// JSON.string 保证普通字符串始终作为字符串处理 
// 等价于：

const fn1 = function () {
  console.log(1)
}
const fn2 = function () {
  'console.log(1)'
}
```
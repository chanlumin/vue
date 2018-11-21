# Observer
1. 属性收集了渲染函数的观察者， 比如name收集一个Watcher


# nextTick 
1. microTask 会在UI渲染之前把数据全部都更新，执行优先于macroTask
2. macroTask setTimeout会把任务都放到macroTask中。
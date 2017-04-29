
## 通过字符串生成查询条件语句

### 安装

```
npm install node-where-filter
```

### 示例

```javascript
const wherefilter = require( 'node-where-filter' );

var exprTree = wherefilter.makeTree( 'name=Jack && age>10 && alias<10', { alias: 'other name' } );
console.log( exprTree );
// echo: [ '&&', [ '=', 'name', 'Jack' ], [ '>', 'age', 10 ] ]

var dataTable = [
	{ name: 'Jack', age: 20 },
	{ name: 'Jack', age: 29 },
	{ name: 'Mike', age: 20 },
	{ name: 'Jack', age: 9 },
];
console.log( dataTable.filter( wherefilter.where( exprTree ) ) );
// echo: [ { name: 'Jack', age: 20 }, { name: 'Jack', age: 29 } ]

console.log( wherefilter.whereSQL( exprTree ) );
// echo: ( `name` = "Jack" ) AND ( `age` > 10 )
```

### 特别说明

```
字符串: "aaa\"bbb"

支持的操作符:
比较操作符: ~(regexp) !~(regexp) = != < > <= >=
规则: key operator value

逻辑操作符: && ||
规则: expr operator expr
```
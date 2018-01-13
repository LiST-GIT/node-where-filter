
## 通过字符串生成查询条件语句

### 安装

```
npm install node-where-filter
```

### 示例

```javascript
const wherefilter = require( 'node-where-filter' );

var exprTree = wherefilter.makeTree( '(name~Jack || name="Mike A") && age>10 && alias<10', { alias: 'other name' } );
console.log( exprTree );
// echo: [ '&&', [ '&&', [ '||', [Array], [Array] ], [ '>', 'age', 10 ] ], [ '<', 'other name', 10 ] ]

var dataTable = [
	{ name: 'Jack A', age: 20, 'other name': 6 },
	{ name: 'Jack B', age: 29, 'other name': 11 },
	{ name: 'Mike A', age: 20, 'other name': 6 },
	{ name: 'Jack',   age: 9 , 'other name': 6 },
];
console.log( dataTable.filter( wherefilter.where( exprTree ) ) );
// echo: [ { name: 'Jack A', age: 20, 'other name': 6 },
//         { name: 'Mike A', age: 20, 'other name': 6 } ]

console.log( wherefilter.whereSQL( exprTree ) );
// echo: ( ( ( `name` LIKE "%Jack%" ) OR ( `name` = "Mike A" ) ) AND ( `age` > 10 ) ) AND ( `other name` < 10 )

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
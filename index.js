var dot = require( 'node-dot-path' );

const TokenizerTree = {};
[
	[ '||' ],
	[ '&&' ],
	[ '~', '!~', '=', '!=', '<', '>', '<=', '>=' ],
].forEach( ( operators, priority ) => {
	operators.forEach( ( operator ) => {
		const pathArray = operator.split( '' );
		dot.set( TokenizerTree, pathArray.concat( [ 'type' ] ), 'operator' );
		dot.set( TokenizerTree, pathArray.concat( [ 'value' ] ), operator );
		dot.set( TokenizerTree, pathArray.concat( [ 'priority' ] ), priority );
	} );
} );
[ '"' ].forEach( ( operator ) => {
	const pathArray = operator.split( '' );
	const TokenizerSubTree = {};
	dot.set( TokenizerSubTree, pathArray.concat( [ 'type' ] ), 'match-right' );
	dot.set( TokenizerSubTree, pathArray.concat( [ 'value' ] ), operator );
	dot.set( TokenizerTree, pathArray.concat( [ 'type' ] ), 'match-left' );
	dot.set( TokenizerTree, pathArray.concat( [ 'value' ] ), operator );
	dot.set( TokenizerTree, pathArray.concat( [ 'end' ] ), TokenizerSubTree );
} );
[ ' ', '\t', '\n', '\r', '(', ')' ].forEach( ( operator ) => {
	const pathArray = operator.split( '' );
	dot.set( TokenizerTree, pathArray.concat( [ 'type' ] ), 'delimit' );
	dot.set( TokenizerTree, pathArray.concat( [ 'value' ] ), operator );
} );
const tokenizer = function( content ) {
	var node = null;
	var start = 0;
	var words = [];
	var match = null;
	var priority = 0;
	content = content + ' ';
	for ( var index = 0; index < content.length; index++ ) {
		const char = content[ index ];
		if ( node === null ) {
			if ( match ) {
				if ( match[ char ] && content[ index - 1 ] !== '\\' ) {
					node = match[ char ];
				}
			} else if ( TokenizerTree[ char ] ) {
				if ( start !== index ) {
					words.push( {
						type: 'literal',
						value: content.slice( start, index ),
						operator: '',
					} );
				}
				node = TokenizerTree[ char ];
				start = index;
			}
		} else {
			if ( node[ char ] ) {
				node = node[ char ];
			} else {
				if ( node.type ) {
					switch ( node.type ) {
					case 'delimit':
						if ( node.value === '(' ) {
							priority += 100;
						} else if ( node.value === ')' ) {
							priority -= 100;
						}
						break;
					case 'match-left':
						match = node.end;
						break;
					case 'match-right':
						words.push( {
							type: 'literal',
							value: content.slice( start, index - node.value.length ),
							operator: node.value,
						} );
						match = null;
						break;
					case 'operator':
						words.push( {
							type: node.type,
							operator: node.value,
							priority: priority + node.priority,
						} );
						break;
					}
					start = index--;
				} else {
					index--;
				}
				node = null;
			}
		}
	}
	return words;
};

const nodeToExpr = function( node ) {
	switch ( node.type ) {
	case 'expr':
		return [ node.operator, nodeToExpr( node.left ), nodeToExpr( node.right ) ];
	case 'literal':
		if ( node.operator === '"' ) {
			return node.value.replace( /(\\[bfnrt\\'"]|\\u[0-f]{4})/ig, ( escape ) => JSON.parse( '"' + escape + '"' ) );
		} else if ( Number.parseFloat( node.value ) == node.value ) {
			return Number.parseFloat( node.value );
		} else {
			return node.value;
		}
	default:
		throw new SyntaxError();
	}
};
const exprCompile = function( expr ) {
	switch ( expr[ 0 ] ) {
	case '&&': case '||':
		return [ expr[ 0 ], exprCompile( expr[ 1 ] ), exprCompile( expr[ 2 ] ) ];
	case '~': case '!~':
		return [ expr[ 0 ], dot.makePathArray( expr[ 1 ] ), new RegExp( expr[ 2 ] ) ];
	case '=': case '!=': case '<': case '>': case '<=': case '>=':
		return [ expr[ 0 ], dot.makePathArray( expr[ 1 ] ), expr[ 2 ] ];
	}
};
const exprExecute = function( expr, data, exec ) {
	switch ( expr[ 0 ] ) {
	case '&&':
		return exprExecute( expr[ 1 ], data ) && exprExecute( expr[ 2 ], data );
	case '||':
		return exprExecute( expr[ 1 ], data ) || exprExecute( expr[ 2 ], data );
	case '~':
		return expr[ 2 ].test( dot.get( data, expr[ 1 ], exec ) );
	case '!~':
		return expr[ 2 ].test( dot.get( data, expr[ 1 ], exec ) ) === false;
	case '=':
		return dot.get( data, expr[ 1 ], exec ) == expr[ 2 ];
	case '!=':
		return dot.get( data, expr[ 1 ], exec ) != expr[ 2 ];
	case '<':
		return dot.get( data, expr[ 1 ], exec ) < expr[ 2 ];
	case '>':
		return dot.get( data, expr[ 1 ], exec ) > expr[ 2 ];
	case '<=':
		return dot.get( data, expr[ 1 ], exec ) <= expr[ 2 ];
	case '>=':
		return dot.get( data, expr[ 1 ], exec ) >= expr[ 2 ];
	}
};
const escape = function( value ) {
	if ( typeof value === 'number' ) {
		return value;
	} else {
		return '"' + value.replace( /"/g, '\\"' ) + '"';
	}
};
const exprToSQL = function( expr ) {
	switch ( expr[ 0 ] ) {
	case '&&':
		return '( ' + exprToSQL( expr[ 1 ] ) + ' ) AND ( ' + exprToSQL( expr[ 2 ] ) + ' )';
	case '||':
		return '( ' + exprToSQL( expr[ 1 ] ) + ' ) OR ( ' + exprToSQL( expr[ 2 ] ) + ' )';
	case '~':
		return '`' + expr[ 1 ] + '` LIKE ' + escape( expr[ 2 ] );
	case '!~':
		return '`' + expr[ 1 ] + '` NOT LIKE ' + escape( expr[ 2 ] );
	case '=': case '!=': case '<': case '>': case '<=': case '>=':
		return '`' + expr[ 1 ] + '` ' + expr[ 0 ] + ' ' + escape( expr[ 2 ] );
	}
};

module.exports = {
	makeTree: function( where, aliases ) {
		var nodes = tokenizer( where );
		var priority = [];
		nodes.forEach( ( node, index ) => {
			node.previous = nodes[ index - 1 ] || null;
			node.next = nodes[ index + 1 ] || null;
			node.type === 'operator' && priority.push( node );
		} );
		priority.sort( ( mon, sun ) => sun.priority - mon.priority );
		aliases = aliases || {};
		var node = priority.map( ( node ) => {
			switch ( node.operator ) {
			case '&&': case '||':
				if ( node.previous && node.previous.type === 'expr' &&
				     node.next && node.next.type === 'expr' ) {
					const expr = {
						type: 'expr',
						operator: node.operator,
						left: node.previous,
						right: node.next,
						previous: node.previous.previous,
						next: node.next.next,
					};
					expr.previous && ( expr.previous.next = expr );
					expr.next && ( expr.next.previous = expr );
					return expr;
				}
				break;
			case '~': case '!~': case '=': case '!=': case '<': case '>': case '<=': case '>=':
				if ( node.previous && node.previous.type === 'literal' &&
				     node.next && node.next.type === 'literal' ) {
					const expr = {
						type: 'expr',
						operator: node.operator,
						left: node.previous,
						right: node.next,
						previous: node.previous.previous,
						next: node.next.next,
					};
					expr.left.value = aliases[ expr.left.value ] || expr.left.value;
					expr.previous && ( expr.previous.next = expr );
					expr.next && ( expr.next.previous = expr );
					return expr;
				}
				break;
			}
			throw new SyntaxError();
		} ).pop();
		return nodeToExpr( node );
	},
	where: function( where, exec ) {
		where = exprCompile( where );
		return ( data ) => exprExecute( where, data, exec );
	},
	whereSQL: function( where ) {
		return exprToSQL( where );
	},
};

"use strict";

var assert = require('assert');

var Query = require('..');

describe('Query', function(){
	it('it is', function(){
		assert(Query.evaluateQuery);
	});
	it('a function', function(){
		assert.equal(typeof Query.evaluateQuery, 'function');
	});
});

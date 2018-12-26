
var rdf = require('rdf');
var BlankNodeMap = require('rdf').BlankNodeMap;

module.exports.Result = Result;
function Result(){
	this.queryType = 'SELECT';
	this.vars = [];
	this.results = [];
	this.value = null;
}

Result.fromJSON = function fromJSON(document){
	var self = new Result;
	var data;
	if(typeof document=='string') data = JSON.parse(document);
	else if(typeof document=='object') data = document;
	else throw new Error('Expected `document` to be a string or object');
	if(typeof document.boolean==='boolean'){
		self.queryType = 'ASK';
		self.value = document.boolean;
	}else if(typeof document.results==='object'){
		self.queryType = 'SELECT';
		self.results = [];
		if(!Array.isArray(data.results.bindings)){
			throw new Error('Expected document.results.bindings to be an Array');
		}
		data.results.bindings.forEach(function(record){
			var result = {};
			resultVars.forEach(function(name){
				var valueData = record[name];
				if(valueData===undefined){
					result[name] = null;
					return;
				}
				switch(valueData.type){
					case 'uri':
						result[name] = 	new rdf.NamedNode(valueData.value);
						break;
					case 'literal':
						result[name] = 	new rdf.Literal(valueData.value);
						break;
					case 'typed-literal':
						result[name] = 	new rdf.Literal(valueData.value, valueData.datatype);
						break;
					case 'bnode':
						result[name] = 	bnodeMap.process(valueData.value);
						break;
					default:
						throw new Error('Unknown type '+JSON.stringify(valueData.type));
				}
			});
			self.results.push(result);
		});
	}
	return self;
}

Result.fromDOM = function fromDOM(doc){
	var self = new Result;
	self.results = [];
	var resultList = doc.getElementsByTagName('result');
	var bnodeMap = new BlankNodeMap;
	for(var i=0; i<resultList.length; i++){
		var res = {};
		var result = resultList[i];
		var bindingList = result.getElementsByTagName('binding');
		for(var j=0; j<bindingList.length; j++){
			var binding = bindingList[j];
			var bindingName = binding.getAttribute('name');
			var bindingChildren = Array.prototype.filter.call(binding.childNodes, function(n){ return n.nodeType==n.ELEMENT_NODE; });
			var bindingValue = bindingChildren[0];
			if(bindingValue===undefined){
				res[bindingName] = null;
				continue;
			}
			switch(bindingValue.nodeName){
				case 'literal':
					res[bindingName] = new rdf.Literal(
						bindingValue.textContent,
						bindingValue.getAttribute('language') || null,
						bindingValue.getAttribute('datatype') || null,
					);
					break;
				case 'uri':
					res[bindingName] = new rdf.NamedNode(
						bindingValue.textContent
					);
					break;
				case 'bnode':
					res[bindingName] = bnodeMap.process(bindingValue.textContent);
					break;
				default:
					throw new Error('Unknown value type '+JSON.stringify(bindingValue.nodeName));
			}
		}
		self.results.push(res);
	}
	return self;
}

Result.fromCSV = function fromCSV(document){
	throw new Error('implement');
}

Result.prototype.toJSON = function toJSON(){
	var vars = [];
	var results = [];
	return {
		head: {
			vars: vars,
		},
		results: {
			bindings: results,
		}
	}
}

Result.prototype.equals = function equals(results){
	var self = this;
	var recordset;
	if(results instanceof Result){
		recordset = results.results;
	}else if(Array.isArray(results)){
		recordset = results;
	}else{
		throw new Error('Expected Array or Result object');
	}
	if(self.results.length!==recordset.length) return false;
	return self.results.every(function(result, i){
		var k0 = Object.keys(result);
		var k1 = Object.keys(recordset[i]);
		if(k0.length!==k1.length) return false;
		return k0.every(function(kn){
			if(result[kn]===recordset[i][kn]) return true;
			return result[kn].equals && result[kn].equals(recordset[i][kn]);
		});
	});
}

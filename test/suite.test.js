"use strict";

var assert = require('assert');
var fs = require('fs');
var rdf = require('rdf');
var env = rdf.environment;
var TurtleParser = rdf.TurtleParser;
var RDFXMLProcessor = require('rdfxmlprocessor');
var DOMParser = require('xmldom').DOMParser;

var mf$ = rdf.ns('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#');
var qt$ = rdf.ns('http://www.w3.org/2001/sw/DataAccess/tests/test-query#');

var SparqlParser = require('sparqljs').Parser;
var evaluateQuery = require('../index.js').evaluateQuery;

var webBase = 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/';
var manifestBase = webBase + 'manifest-all.ttl';
//var manifestBase = 'file://'+__dirname+'/TurtleTests/manifest.ttl';
var manifestData = require('fs').readFileSync('test/sparql11-test-suite/manifest-all.ttl', 'UTF-8');
var manifestParse = TurtleParser.parse(manifestData, manifestBase);
var manifestGraph = manifestParse.graph;

var manifestRest = manifestGraph.reference(manifestBase).rel(mf$('include')).one();
var manifestTests = manifestGraph.getCollection(manifestRest).map(function(m){
	return {
		base: m.toString(),
		filename: m.toString().replace('http://www.w3.org/2009/sparql/docs/tests/data-sparql11/', 'test/sparql11-test-suite/'),
		//label: manifestGraph.reference(m).rel(rdf.rdfsns('label')).one().toString(),
	}
});

function parseResult(doc){
	if(typeof doc==='string'){
		doc = new DOMParser().parseFromString(doc);
	}
	var results = [];
	var resultList = doc.getElementsByTagName('result');
	var bnodeMap = new rdf.BlankNodeMap;
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
		results.push(res);
	}
	return results;
}

describe('SPARQL test suite', function(){
	it('Parse SPARQL test suite manifest', function(){
		assert(manifestTests.length);
	});
	manifestTests.forEach(function(suite){
		var suiteData = require('fs').readFileSync(suite.filename, 'UTF-8');
		var suiteParse = TurtleParser.parse(suiteData, suite.base);
		var suiteGraph = suiteParse.graph;
		var suiteLabel = suiteGraph.reference(suite.base).rel(rdf.rdfsns('label')).one() || suiteGraph.reference(suite.base).rel(rdf.rdfsns('comment')).one();
		suiteLabel = suiteLabel.toString();
		var suiteRest = suiteGraph.reference(suite.base).rel(mf$('entries')).one();
		describe(suiteLabel, function(){
			suiteGraph.getCollection(suiteRest).forEach(function(m){
				var testNode = suiteGraph.reference(m);
				var name = testNode.rel(mf$('name')).toArray().join('---');
				var testFn = testNode.rel(rdf.rdfns('type')).reduce(function(previous, node){
					if(node.equals(mf$('UpdateEvaluationTest'))) return genUpdateEvaluationTest;
					if(node.equals(mf$('QueryEvaluationTest'))) return genQueryEvaluationTest;
					if(node.equals(mf$('NegativeSyntaxTest11'))) return genNegativeSyntaxTest11;
					if(node.equals(mf$('PositiveSyntaxTest11'))) return genPositiveSyntaxTest11;
					if(node.equals(mf$('PositiveUpdateSyntaxTest11'))) return genPositiveUpdateSyntaxTest11;
					if(node.equals(mf$('NegativeUpdateSyntaxTest11'))) return genNegativeUpdateSyntaxTest11;
					if(node.equals(mf$('ServiceDescriptionTest'))) return genServiceDescriptionTest;
					if(node.equals(mf$('CSVResultFormatTest'))) return genCSVResultFormatTest;
					if(node.equals(mf$('ProtocolTest'))) return genProtocolTest;
					return previous;
				}, null);
				if(!testFn) throw new Error('Could not find test type for '+suiteRest+ testNode.rel(rdf.rdfns('type')).toArray().join());
				testFn(testNode, name);
			});
		});
	});
});

function genUpdateEvaluationTest(testNode, name){
	//it('UpdateEvaluationTest: '+name, function(){});
}
function genQueryEvaluationTest(testNode, name){
	var actionNode = testNode.rel(mf$('action'));
	var queryFilename = actionNode.rel(qt$('query')).one();
	var dataURI = actionNode.rel(qt$('data')).one();
	var resultURI = testNode.rel(mf$('result')).one();
	var graph_base = 'http://example.com/';
	it('QueryEvaluationTest: '+name, function(){
		var sparql_text = fs.readFileSync(queryFilename.toString().replace(webBase, __dirname+'/sparql11-test-suite/'), 'UTF-8');
		var parseQueryResult = new SparqlParser({}, graph_base).parse(sparql_text);
		if(dataURI){
			var dataFilename = dataURI.toString().replace(webBase, __dirname+'/sparql11-test-suite/');
			var data_text = fs.readFileSync(dataFilename, 'UTF-8');
			if(dataFilename.match(/\.rdf$/)){
				var document = new DOMParser().parseFromString(data_text);
				var parser = new RDFXMLProcessor({
					namedNode: rdf.environment.createNamedNode,
					quad: rdf.environment.createTriple,
					literal: rdf.environment.createLiteral
				});
				var dataGraphResult = new rdf.Graph;
				parser.parse(document, dataURI.toString(), dataURI.toString(), function(t){
					if(t) dataGraphResult.add(t);
					//else throw new Error();
				});
			}else if(dataFilename.match(/\.nt/) || dataFilename.match(/\.ttl/)){
				var dataGraphResult = TurtleParser.parse(data_text, graph_base).graph;
				var dataGraph = dataGraphResult.graph;
			}else{
				throw new Error('Unknown filename format: '+dataFilename);
			}
		}
		if(resultURI){
			var resultFilename = resultURI.toString().replace(webBase, __dirname+'/sparql11-test-suite/');
			if(resultFilename.match(/\.srx$/)){
				var resultText = fs.readFileSync(resultFilename, 'UTF-8');
				var resultDOM = new DOMParser().parseFromString(resultText);
				var resultExpected = parseResult(resultDOM);
				// console.log(parseResultList);
				assert(Array.isArray(resultExpected));
			}else if(resultFilename.match(/\.srj$/)){
				var resultText = fs.readFileSync(resultFilename, 'UTF-8');
				var resultData = JSON.parse(resultText);
				var resultVars = resultData.head.vars;
				var bnodeMap = new rdf.BlankNodeMap;
				var resultExpected = [];
				if(resultData.results){
					resultData.results.bindings.forEach(function(record){
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
						resultExpected.push(result);
					});
					assert(Array.isArray(resultExpected));
				}
			}else if(resultFilename.match(/\.ttl$/)){
				var resultText = fs.readFileSync(resultFilename, 'UTF-8');
				var resultGraph = TurtleParser.parse(resultText, graph_base).graph;
				assert(resultGraph);
			}else{
				throw new Error('Unknown filename format: '+resultFilename);
			}
		}
	});
}
function genNegativeSyntaxTest11(testNode, name){
	var queryFilename = testNode.rel(mf$('action')).one();
	var graph_base = 'http://example.com/';
	it('NegativeSyntaxTest11: '+name, function(){
		var sparql_text = fs.readFileSync(queryFilename.toString().replace(webBase, __dirname+'/sparql11-test-suite/'), 'UTF-8');
		assert.throws(function(){
			var parseQueryResult = new SparqlParser({}, graph_base).parse(sparql_text);
		});
	});
}
function genPositiveSyntaxTest11(testNode, name){
	var queryFilename = testNode.rel(mf$('action')).one();
	var graph_base = 'http://example.com/';
	it('PositiveSyntaxTest11: '+name, function(){
		var sparql_text = fs.readFileSync(queryFilename.toString().replace(webBase, __dirname+'/sparql11-test-suite/'), 'UTF-8');
		var parseQueryResult = new SparqlParser({}, graph_base).parse(sparql_text);
	});
}
function genPositiveUpdateSyntaxTest11(testNode, name){
	//it('PositiveUpdateSyntaxTest11: '+name, function(){});
}
function genNegativeUpdateSyntaxTest11(testNode, name){
	//it('NegativeUpdateSyntaxTest11: '+name, function(){});
}
function genServiceDescriptionTest(testNode, name){
	// Out of scope
	//it('ServiceDescriptionTest: '+name, function(){});
}
function genCSVResultFormatTest(testNode, name){
	//it('CSVResultFormatTest: '+name, function(){});
}
function genProtocolTest(testNode, name){
	// Out of scope
	//it('ProtocolTest: '+name, function(){});
}

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

function importTests(manifestBase){
}

describe('Turtle test suite', function(){
	it('Parse Turtle test suite manifest', function(){
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
   var dataFilename = actionNode.rel(qt$('data')).one();
   var resultFilename = testNode.rel(mf$('result')).one();
	var graph_base = 'http://example.com/';
	it('QueryEvaluationTest: '+name, function(){
      var sparql_text = fs.readFileSync(queryFilename.toString().replace(webBase, __dirname+'/sparql11-test-suite/'), 'UTF-8');
      var parseQueryResult = new SparqlParser({}, graph_base).parse(sparql_text);
      if(dataFilename){
			dataFilename = dataFilename.toString();
         var data_text = fs.readFileSync(dataFilename.toString().replace(webBase, __dirname+'/sparql11-test-suite/'), 'UTF-8');
			if(dataFilename.match(/\.rdf$/)){
				var document = new DOMParser().parseFromString(data_text);
				var parser = new RDFXMLProcessor({
					namedNode: rdf.environment.createNamedNode,
					quad: rdf.environment.createTriple,
					literal: rdf.environment.createLiteral
				});
				var dataGraphResult = parser.parse(document, dataFilename, dataFilename, function(){});
			}else if(dataFilename.match(/\.nt/) || dataFilename.match(/\.ttl/)){
				var dataGraphResult = TurtleParser.parse(data_text, graph_base);
			}else{
				throw new Error('Unknown filename format: '+dataFilename);
			}
      }
      if(resultFilename){
         var result_text = fs.readFileSync(resultFilename.toString().replace(webBase, __dirname+'/sparql11-test-suite/'), 'UTF-8');
			var parseResultDocument = new DOMParser().parseFromString(result_text);
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

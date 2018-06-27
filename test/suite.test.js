"use strict";

var assert = require('assert');
var fs = require('fs');
var rdf = require('rdf');
var env = rdf.environment;
var TurtleParser = rdf.TurtleParser;

var mf$ = rdf.ns('http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#');

var manifestBase = 'http://www.w3.org/2009/sparql/docs/tests/data-sparql11/manifest-all.ttl';
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
					if(node.equals(mf$('CSVResultFormatTest'))) return genCSVResultFormatTest;
					if(node.equals(mf$('PositiveSyntaxTest11'))) return genPositiveSyntaxTest11;
					if(node.equals(mf$('PositiveUpdateSyntaxTest11'))) return genPositiveUpdateSyntaxTest11;
					if(node.equals(mf$('NegativeUpdateSyntaxTest11'))) return genNegativeUpdateSyntaxTest11;
					if(node.equals(mf$('ServiceDescriptionTest'))) return genServiceDescriptionTest;
					if(node.equals(mf$('ProtocolTest'))) return genProtocolTest;
					return previous;
				}, null);
				if(!testFn) throw new Error('Could not find test type for '+suiteRest+ testNode.rel(rdf.rdfns('type')).toArray().join());
				testFn(suiteRest, name);
			});
		});
	});
});

function genUpdateEvaluationTest(testNode, name){
	it('UpdateEvaluationTest: '+name, function(){});
}
function genQueryEvaluationTest(testNode, name){
	it('QueryEvaluationTest: '+name, function(){});
}
function genNegativeSyntaxTest11(testNode, name){
	it('NegativeSyntaxTest11: '+name, function(){});
}
function genCSVResultFormatTest(testNode, name){
	it('CSVResultFormatTest: '+name, function(){});
}
function genPositiveSyntaxTest11(testNode, name){
	it('PositiveSyntaxTest11: '+name, function(){});
}
function genPositiveUpdateSyntaxTest11(testNode, name){
	it('PositiveUpdateSyntaxTest11: '+name, function(){});
}
function genNegativeUpdateSyntaxTest11(testNode, name){
	it('NegativeUpdateSyntaxTest11: '+name, function(){});
}
function genServiceDescriptionTest(testNode, name){
	// Out of scope
	//it('ServiceDescriptionTest: '+name, function(){});
}
function genProtocolTest(testNode, name){
	// Out of scope
	//it('ProtocolTest: '+name, function(){});
}

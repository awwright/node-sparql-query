"use strict";

var TurtleParser = require('rdf').TurtleParser;
var SparqlParser = require('sparqljs').Parser;
var evaluateQuery = require('../lib/rdf-query.js').evaluateQuery;
var xhtmlns = 'http://www.w3.org/1999/xhtml';

var graph_base;
var graph_ttl;
var graph_json;
var sparql_base;
var sparql_text;
var sparql_json;
var rs_json;
var rs_thead;
var rs_tbody;

var parseGraphResult;
var parseQueryResult;

document.addEventListener("DOMContentLoaded", function(event) {
	graph_base = document.getElementById('graph-base');
	graph_ttl = document.getElementById('graph-ttl');
	graph_json = document.getElementById('graph-json');
	sparql_text = document.getElementById('query-sparql');
	sparql_json = document.getElementById('query-json');
	rs_json = document.getElementById('rs-json');
	rs_thead = document.getElementById('rs-head');
	rs_tbody = document.getElementById('rs-body');
	graph_base.onchange = function(){ parseGraph(); executeQuery(); };
	graph_ttl.onchange = function(){ parseGraph(); executeQuery(); };
	sparql_text.onchange = function(){ parseSparql(); executeQuery(); };
	parseGraph();
	parseSparql();
	executeQuery();
});

function parseGraph(){
	parseGraphResult = TurtleParser.parse(graph_ttl.value, graph_base.value);
	graph_json.textContent = parseGraphResult.graph.toArray().map(function(v){ return v.toString()+"\n"; }).join('');
	executeQuery();
}

function parseSparql(){
	parseQueryResult = new SparqlParser().parse(sparql_text.value);
	sparql_json.textContent = JSON.stringify(parseQuery, null, '\t');
	executeQuery();
}

function executeQuery(){
	if(!parseGraphResult || !parseQueryResult) return;
	var results = evaluateQuery(parseGraphResult.graph, parseQueryResult);
	//rs_json.textContent = JSON.stringify(results, null, '\t');
	// Update rows
	while(rs_tbody.firstChild) rs_tbody.removeChild(rs_tbody.firstChild);
	results.forEach(function(item){
		var rs_tr = document.createElementNS(xhtmlns, 'tr');
		for(var k in item){
			var rs_td = document.createElementNS(xhtmlns, 'td');
			rs_td.textContent = item[k].toTurtle();
			rs_tr.appendChild(rs_td);
		}
		rs_tbody.appendChild(rs_tr);
	});
}

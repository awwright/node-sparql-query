/** Memory Database, an in-memory RDF store
 */
var rdf=require('rdf');

function toNode(str){
	if(str[0]=='?') return new rdf.Variable(str);
	if(str[0]=='_') return new rdf.BlankNode(str);
	if(str[0]=='"') return new rdf.Literal(str);
	return new rdf.NamedNode(str);
}

module.exports.evaluateQuery = function(dataGraph, query, objectBindings){
	var queryGraph = dataGraph;
	var self=this;

	var bindings = {};
	for(var f in (objectBindings||{})) bindings['_:var:'+f]=objectBindings[f];

	function constructTriples(result){
		var template = query.template;
		var templates = template.map(function(triple){
			return new rdf.TriplePattern(toNode(triple.subject), toNode(triple.predicate), toNode(triple.object));
		});
		var triples = []; // Later maybe we want a triple store?
		// Now build the triples
		result.forEach(function(res, i){
			templates.forEach(function(tpl, j){
				triples.push(new rdf.Triple(
					res[varName(tpl.subject)]||tpl.subject, res[varName(tpl.predicate)]||tpl.predicate, res[varName(tpl.object)]||tpl.object
				));
			});
		});
		return triples;
	}

	function orderResults(result){
		var orderBy = query.order;
		var order = orderBy.map(function(rest){
			var direction = rest.descending ? -1 : 1 ;
			return {
				direction: direction,
				field: rest.expression,
			};
		});
		return result.sort(function(a, b){
			for(var i=0; i<order.length; i++){
				if(a[order[i].field] && b[order[i].field]){
					if(a[order[i].field]>b[order[i].field]) return order[i].direction;
					if(a[order[i].field]<b[order[i].field]) return -order[i].direction;
				}
			}
			return 0;
		});
	}

	var queryType, processResult;
	switch(query.queryType){
		case 'SELECT':
			queryType = "Select";
			processResult = function(results){
				return query.order ? orderResults(results) : results;
			};
			break;
		case 'CONSTRUCT':
			queryType = "Construct";
			if(!query.template){
				throw new Error("Construct query that has no template");
			}
			processResult = constructTriples;
			break;
		case 'update':
			queryType = "Modify";
			var deletePattern = queryGraph.match(querySubject, sp("deletePattern")).map(function(v){return v.object})[0];
			var insertPattern = queryGraph.match(querySubject, sp("insertPattern")).map(function(v){return v.object})[0];
			if(!insertPattern && !deletePattern){
				throw new Error("Modify query that has no insertPattern or deletePattern");
			}
			processResult = function(results){
				// Delete first
				var deleteTriples = constructTriples(deletePattern, results);
				var insertTriples = constructTriples(insertPattern, results);
				for(var i=0; i<deleteTriples.length; i++) self.remove(deleteTriples[i]);
				for(var i=0; i<insertTriples.length; i++) self.add(insertTriples[i]);
				self.commit();
				return {"results":results, "delete":deleteTriples, "insert":insertTriples};
			};
			break;
	}
	if(!queryType) throw new Error("Not a sp:Select, sp:Construct, or sp:Modify query");
	var matches = [];
	// resultVars = ?querySubject/sp:resultVariables
	var resultVars = query.variables;
	if(resultVars[0]==='*'){
	}
	
	function indexVariable(v){
		if(v.termType=='BlankNode'){
			matchVariables[v] = { label:v.toString(), type:'BlankNode' };
		}else if(v.termType=='Variable'){
			matchVariables[v] = { label:v.toString(), type:'Variable' };
		}
	}

	if(!query.where) throw new Error('Expected "where" clause');
	var matchVariables = {};
	var matchStatements = [];
	query.where.forEach(function(block){
		if(block.type=='bgp'){
			block.triples.forEach(function(triple){
				if(typeof triple.subject=='string' && typeof triple.predicate=='string' && typeof triple.object=='string'){
					var pattern = new rdf.TriplePattern(toNode(triple.subject), toNode(triple.predicate), toNode(triple.object));
					matchStatements.push(pattern);
					indexVariable(pattern.subject);
					indexVariable(pattern.predicate);
					indexVariable(pattern.object);
				}
			});
		}
	});
	var matchVariablesList = Object.values(matchVariables);
	
	var stack = [ {i:0, depth:0, bindings:{}} ];
	while(stack.length){
		var state = stack.pop();
		if(state.i===matchStatements.length) throw new Error('Everything already evaluated??');
		if(state.depth===matchVariablesList.length) throw new Error('Everything already bound??');
		var stmt = matchStatements[state.i];
		// If it's a bnode, then map it. If it's not mapped, use `null` to search for any values.
		// in theory the predicate will never be a bnode, but the additional test shouldn't hurt anything
		var stmtsubject = (stmt.subject.termType==='BlankNode' || stmt.subject.termType==='Variable') ? (state.bindings[stmt.subject] || null) : stmt.subject ;
		var stmtpredicate = (stmt.predicate.termType==='BlankNode' || stmt.predicate.termType==='Variable') ? (state.bindings[stmt.predicate] || null) : stmt.predicate ;
		var stmtobject = (stmt.object.termType==='BlankNode' || stmt.object.termType==='Variable') ? (state.bindings[stmt.object] || null) : stmt.object ;
		var stmtMatches = dataGraph.match(stmtsubject, stmtpredicate, stmtobject).filter(function(m){
			// certain things we can filter out right away, do that here
//			if(stmtsubject===null && m.subject.nodeType()!=='BlankNode') return false;
//			if(stmtpredicate===null && m.predicate.nodeType()!=='BlankNode') return false;
//			if(stmtobject===null && m.object.nodeType()!=='BlankNode') return false;
			return true;
		});
		if(stmtsubject && stmtpredicate && stmtobject){
			if(stmtMatches.length===1){
				// if there's a single match where all nodes match exactly, push the comparison for the next item
				stack.push({ i:state.i+1, depth:state.depth, bindings:state.bindings });
			}else if(stmtMatches.length===0){
				continue;
			}else{
				throw new Error('Multiple matches, expected exactly one or zero match');
			}
		}else{
			// otherwise there's an unbound bnode, get the possible mappings and push those onto the stack
			stmtMatches.forEach(function(match){
				var b2 = {};
				var depth = state.depth
				for(var n in state.bindings) b2[n] = state.bindings[n];
				if(stmtsubject===null){
					if(b2[stmt.subject]===undefined){
						b2[stmt.subject] = match.subject;
						depth++;
					}else{
						return;
					}
				}
				if(stmtpredicate===null && b2[stmt.predicate]===undefined){
					if(b2[stmt.predicate]===undefined){
						b2[stmt.predicate] = match.predicate;
						depth++;
					}else{
						return;
					}
				}
				if(stmtobject===null){
					if(b2[stmt.object]===undefined){
						b2[stmt.object] = match.object;
						depth++;
					}else{
						return;
					}
				}
				if(state.i+1===matchStatements.length && depth===matchVariablesList.length){
					matches.push(b2);
				}else{
					stack.push({ i:state.i+1, depth:depth, bindings:b2 });
				}
			});
		}
	}

	return processResult(matches);
}

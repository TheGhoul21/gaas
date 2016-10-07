import {
	GraphQLEnumType,
	GraphQLInterfaceType,
	GraphQLObjectType,
	GraphQLList,
	GraphQLNonNull,
	GraphQLSchema,
	GraphQLString,
	GraphQLBoolean,
	GraphQLID,
  GraphQLInputObjectType
	} from 'graphql/type';

import pluralize from 'pluralize';
import {
  fieldResolver,
  resolveThunk,
  resolveAddThunk,
	resolveAddRelationItemToParent,
	entityResolver
} from './resolvers';

import { getAllEntities, parseType, defaultTypes } from './sandbox';

import {
  btoa
} from './utils'

const express = require('express');
const graphqlHTTP = require('express-graphql');

const app = express();

import AppSchema from './AppSchema';
// AppSchema
// 	.get('test')
// 	.then(console.log);





function* entries(obj) {
	for (let key of Object.keys(obj)) {
		yield [key, obj[key]];
	}
}

let queries = {};
let mutations = {};
let type = {};

let name, fields, spec, outputType, inputType;


let outputTypes = {};
let inputTypes = {};

let NodeInterface = new GraphQLInterfaceType({
	name: 'Node',
	fields: {
		id: {
			type: new GraphQLNonNull(GraphQLID)
		}
	},
	resolveType: function(root, args) {
		console.log(args.id);
	}
});


let rootQueryFields = {
	node: {
		type: NodeInterface,
		args: {
			id: {
				type: new GraphQLNonNull(GraphQLID)
			},
		},
		resolve: (root, args) => {
			console.log(args);
		}
	}
};

let rootMutationFields = {};

function getOutputFieldsThunk(entityName, fields) {
	return () => {
		let tempOutputFields = {};
		for(var i in fields) {
			spec = parseType(fields[i].type);

			// spec.typeName, spec.required, spec.isArray
			let type;
			if(defaultTypes[spec.typeName]) {
				type = defaultTypes[spec.typeName];
			} else {
				type = outputTypes[spec.typeName + 'Type'];
			}

			if(spec.isArray) {
				type = new GraphQLList(type);
			}
			if(spec.required && spec.typeName != 'ID') {
				type = new GraphQLNonNull(type);
			}
			tempOutputFields[fields[i].name] = {
				type: type,
				resolve: fieldResolver(entityName, fields[i].name, spec)
			};
		}
		return tempOutputFields;
	}
}

function getInputFieldsThunk(entityName, fields) {
	return () => {
		let tempInputFields = {};
		for(var i in fields) {
			spec = parseType(fields[i].type);

			if(spec.typeName != 'ID' && !spec.isArray) {
				// spec.typeName, spec.required, spec.isArray
				let type;
				if(defaultTypes[spec.typeName]) {
					type = defaultTypes[spec.typeName];
				} else {
					type = GraphQLString;
				}

				if(spec.isArray) {
					type = new GraphQLList(type);
				}
				if(spec.required) {
					type = new GraphQLNonNull(type);
				}
				tempInputFields[fields[i].name] = {
					type: type
				};
			}
		}
		return tempInputFields;
	}
}

Promise.resolve(getAllEntities())
	.then(function(types) {
		for(var i in types) {
			name = types[i].name;
			fields = types[i].fields;

			// first for create output and input types based on the spec
			let fieldsThunk = getOutputFieldsThunk(name, fields);
			outputType = { name : name + 'Type', fields : fieldsThunk, interfaces: [NodeInterface] };
			outputTypes[outputType.name] = new GraphQLObjectType(outputType);
			inputType = { name : name + 'Input', fields: getInputFieldsThunk(name, fields) };
			inputTypes[inputType.name] = new GraphQLInputObjectType(inputType);

			rootQueryFields[pluralize(name.toLowerCase(), 1)] = {
				type: outputTypes[outputType.name],
				args: {
					id: {
						type: new GraphQLNonNull(GraphQLID)
					},
				},
				resolve: entityResolver()
			}
			rootMutationFields['Introduce' + pluralize(name, 1)] = {
				type: outputTypes[outputType.name],
				args: {
					input: {
						type: new GraphQLNonNull(inputTypes[inputType.name])
					},
				},
				resolve: resolveAddThunk(name)
			}

			for(var i in fields) {
				let spec = parseType(fields[i].type);
				if(spec.entityRelation) {
					let fieldName = pluralize(fields[i].name,1);
					let mutationName = "Add" + fieldName[0].toUpperCase() + fieldName.substring(1) + "To"+ name;

					rootMutationFields[mutationName] = {
						type: outputTypes[outputType.name],
						args: {
							input: {
								type: new GraphQLNonNull(new GraphQLInputObjectType({
									name: mutationName + 'Input',
									fields: ((_spec) => () => ({
											_parent: {type: new GraphQLNonNull(GraphQLString)},
											_child: {type: GraphQLString},
											_childObject: {type: inputTypes[_spec.typeName + 'Input']}
										})
									)(spec)
								}))
							},
						},
						resolve: resolveAddRelationItemToParent(name, fields[i].name, spec)
					}
				}
			}

		}
		return Promise.resolve([rootQueryFields, rootMutationFields]);
	})
	.then(function(rootFields) {
		app.use('/graphql', graphqlHTTP({
			schema: new GraphQLSchema({
				query: new GraphQLObjectType({
					name: 'RootQueryType',
					fields: () => (rootFields[0])
				}),
		    mutation: new GraphQLObjectType({
		      name: 'RootMutationType',
		      fields: () => (rootFields[1])
		    }),
				types: Object.keys(outputTypes).map(x => outputTypes[x])
			}),
			graphiql: true
		}));
	})
	.catch(function(error) {
		console.error(error.stack);
	});

app.listen(process.env.PORT || 3000);

console.log("app listening on port " + (process.env.PORT || 3000));

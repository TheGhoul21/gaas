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
} from './resolvers';

import {
  btoa
} from './utils'
var YAML = require('yamljs');

const express = require('express');
const graphqlHTTP = require('express-graphql');

const app = express();



var requiredEnum = {
	YES: "YES",
	NO: "NO",
	OPTIONAL: "OPTIONAL"
}

// var requiredType = new GraphQLEnumType ({
// 	name: "required",
// 	values: requiredEnum
// });


var TopicTypeFields = {
	"id": {
		"type": "ID",
		"indexable": true,
	},
	"text": {
		"type": "String",
		"required": "YES",
	},
	"pros": {
		"type": [
			"TopicFactor"
		],
		"required": "NO",
    "relation": {
      "type": "OneToMany",
      "localKey": "id",
      "foreignKey": "topic",
    }
	},
	"cons": {
		"type": [
			"TopicFactor"
		],
		"required": "NO",
    "relation": {
      "type": "OneToMany",
      "localKey": "id",
      "foreignKey": "topic",
    }
	},
	"user": {
		"type": "User",
		"required": "NO",
		"defaultUser": true
	}
};

var TopicFactorTypeFields = {
	"id": {
		"type": "ID",
		"indexable": true,
	},
	"text": {
		"type": "String!",
		"required": "YES"
	},
  "isPro": {
    "type": "Boolean!",
    "required": "YES"
  },
  "topic": {
    "type": "Topic",
    "required": "YES",
    "relation": {
      "type": "ManyToOne",
      "localKey": "topic",
      "foreignKey": "id",
    }
  }
};
var UserTypeFields = {
	"id": {
		"type": "ID",
		"indexable": true,
	},
	"username": {
		"type": "String",
    "required": "YES"
	}
};


export var types = {
	TopicFactor: TopicFactorTypeFields,
	Topic: TopicTypeFields,
	User: UserTypeFields
};


function* entries(obj) {
	for (let key of Object.keys(obj)) {
		yield [key, obj[key]];
	}
}

let queries = {};
let mutations = {};
let type = {};

var defaultTypes = {
	"String": GraphQLString,
	"String!": new GraphQLNonNull(GraphQLString),
	"ID": new GraphQLNonNull(GraphQLID),
  "Boolean": GraphQLBoolean,
  "Boolean!":  new GraphQLNonNull(GraphQLBoolean)
}

let graphQLTypes = {};
let graphQLInputTypes = {};
let args = {};


for (let [key, fields] of entries(types)) {

	var fieldsThunk = ((fields) => {
		return function() {

			let tempFields = {};
			let tempArgs = {};
			let _type;
			for (let [fieldName, config] of entries(fields)) {
				if (defaultTypes[config.type] || types[config.type]) {
					if (defaultTypes[config.type]) {
						tempFields[fieldName] = {
							type: defaultTypes[config.type]
						};
					} else {
						tempFields[fieldName] = {
							type: config.type.join ? new GraphQLList(graphQLTypes[config.type[0].toLowerCase()]) : graphQLTypes[config.type.toLowerCase()],
              // resolve: ((fieldName) => (obj) => Promise.resolve(re_______disClient.hgetallAsync(obj[fieldName])))(fieldName)
              resolve: fieldResolver(fieldName, config)
						};
					}
				}
			}
			return tempFields;
		}
	})(fields);

	var inputFieldsThunk = ((fields) => {
		return function() {

			let tempFields = {};
			let tempArgs = {};
			let _type;
			for (let [fieldName, config] of entries(fields)) {
				if ((config.required == requiredEnum.YES || config.required == requiredEnum.OPTIONAL) &&
						(defaultTypes[config.type] || types[config.type])) {
					if (defaultTypes[config.type]) {
						tempFields[fieldName] = {
							type: defaultTypes[config.type]
						};
					} else {
						tempFields[fieldName] = {
							type: defaultTypes.ID
						};
					}
				}
			}

			return tempFields;
		}
	})(fields);

	let argsThunk = ((fields) => {

		let tempArgs = {};
		let _type;
		for (let [fieldName, config] of entries(fields)) {
			if (config.indexable && (defaultTypes[config.type] || types[config.type])) {

				if (defaultTypes[config.type]) {
					tempArgs[fieldName] = {
						type: defaultTypes[config.type]
					};
				} else {
					tempArgs[fieldName] = {
						type: config.type.join ? new GraphQLList(graphQLTypes[config.type[0].toLowerCase()]) : graphQLTypes[config.type.toLowerCase()]
					};
				}
			}
		}
		return tempArgs;
	})(fields);

	graphQLTypes[key.toLowerCase()] = new GraphQLObjectType({
		name: key,
		fields: fieldsThunk
	});


	queries[key.toLowerCase()] = {
		type: graphQLTypes[key.toLowerCase()],
		args: argsThunk,
		resolve: resolveThunk(key)
	}

  graphQLInputTypes[key + 'Input'] = new GraphQLInputObjectType({
    name: key + 'Input',
    fields: inputFieldsThunk
  });


	mutations["add" + key] = {
		type: graphQLTypes[key.toLowerCase()],
    name: 'add' + key,
		args: {
      input: { type: graphQLInputTypes[key + 'Input'] }
    },
		resolve: resolveAddThunk(key, fields)
	}
}



const queryType = new GraphQLObjectType({
	name: 'RootQueryType',
	fields: () => (queries)
});

app.use('/graphql', graphqlHTTP({
	schema: new GraphQLSchema({
		query: queryType,
    mutation: new GraphQLObjectType({
      name: 'RootMutationType',
      fields: () => (mutations)
    }),
		types: Object.keys(graphQLTypes).map(x => graphQLTypes[x])
	}),
	graphiql: true
}));

app.listen(process.env.PORT || 3000);

console.log("app listening on port " + (process.env.PORT || 3000));

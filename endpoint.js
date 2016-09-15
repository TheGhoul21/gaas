import {
	GraphQLEnumType,
	GraphQLInterfaceType,
	GraphQLObjectType,
	GraphQLList,
	GraphQLNonNull,
	GraphQLSchema,
	GraphQLString,
	GraphQLID
} from 'graphql/type';

var YAML = require('yamljs');

import redis from 'redis';
import bluebird from 'bluebird';

let redisClient = redis.createClient();

let redisGet = bluebird.promisify(redisClient.get, {context: redisClient});
let redisGetHash = bluebird.promisify(redisClient.hgetall, {context: redisClient});
// let redisSetHash = bluebird.promisify(redisClient.hsetall, {context: redisClient});
const express = require('express');
const graphqlHTTP = require('express-graphql');

const app = express();

var requiredEnum = {
	YES: "YES",
	NO: "NO",
	OPTIONAL: "OPTIONAL"
}


var testObject = {
			id: 1,
			text: "topic" + ": " + "AAAA",
// 			pros: [
// 				{id:1, text:"a"},
// 				{id:2, text:"b"},
// 			]
		};

redisClient.hmset('hello', testObject, function() {
	console.log(arguments);
});
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
		"required": "NO"
	},
	"cons": {
		"type": [
			"TopicFactor"
		],
		"required": "NO"
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
		"type": "String",
		"required": "YES"
	}
};
var UserTypeFields = {
	"id": {
		"type": "ID",
		"indexable": true,
	},
	"username": {
		"type": "String"
	}
};


var types = {
	TopicFactor: TopicFactorTypeFields,
	Topic: TopicTypeFields,
	User: UserTypeFields
};

function* entries(obj) {
	for (let key of Object.keys(obj)) {
		yield [key, obj[key]];
	}
}

let schema = {};
let type = {};

var defaultTypes = {
	"String": GraphQLString,
	"String!": new GraphQLNonNull(GraphQLString),
	"ID": new GraphQLNonNull(GraphQLID),

}

let graphQLTypes = {};

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
							type: config.type.join ? new GraphQLList(graphQLTypes[config.type[0].toLowerCase()]) : graphQLTypes[config.type.toLowerCase()]
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
							type: config.type.join ? new GraphQLList(graphQLTypes[config.type[0].toLowerCase()]) : graphQLTypes[config.type.toLowerCase()]
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


	var resolveThunk = ((key) => (root, args) => {
		var value = Promise.resolve(redisGetHash("hello"));
		
		console.log(value);
		
		return value;
// 		return {
// 			id: args.id,
// 			text: key + ": " + "AAAA",
// 			pros: [
// 				{id:1, text:"a"},
// 				{id:2, text:"b"},
// 			]
// 		}
	})(key);


	graphQLTypes[key.toLowerCase()] = new GraphQLObjectType({
		name: key,
		fields: fieldsThunk
	});


	schema[key.toLowerCase()] = {
		type: graphQLTypes[key.toLowerCase()],
		args: argsThunk,
		resolve: resolveThunk
	}
}

const queryType = new GraphQLObjectType({
	name: 'RootQueryType',
	fields: () => (schema)
});

app.use('/graphql', graphqlHTTP({
	schema: new GraphQLSchema({
		query: queryType,
		types: Object.keys(graphQLTypes).map(x => graphQLTypes[x])
	}),
	graphiql: true
}));

app.listen(process.env.PORT || 3000);
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

var YAML = require('yamljs');

import redis from 'redis';
import bluebird from 'bluebird';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let redisClient = redis.createClient();

let redisGet = bluebird.promisify(redisClient.get, {context: redisClient});
let redisGetHash = bluebird.promisify(redisClient.hgetall, {context: redisClient});
let redisIncr = bluebird.promisify(redisClient.incr, {context: redisClient});
// let redisSetHash = bluebird.promisify(redisClient.hsetall, {context: redisClient});
const express = require('express');
const graphqlHTTP = require('express-graphql');

const app = express();


function btoa(str) {
  return new Buffer(str).toString('base64');
}
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
		"type": "String!",
		"required": "YES"
	},
  "isPro": {
    "type": "Boolean!",
    "required": "YES"
  },
  "topic": {
    "type": "Topic",
    "required": "YES"
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
              resolve: ((fieldName) => (obj) => Promise.resolve(redisClient.hgetallAsync(obj[fieldName])))(fieldName)
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


	var resolveThunk = ((key) => (root, args) => {
    let value = Promise.resolve(redisClient.hgetallAsync(args.id));
		return value;
	})(key);

	var resolveAddThunk = ((key) => (root, args) => {
		return Promise.resolve(redisClient.incrAsync(key+"Id").then((id) => {
      args.input.id = btoa(key.toLowerCase() + ":" + id);
      redisClient.hmset(args.input.id, args.input);
      return args.input;
    }))
	})(key);


	graphQLTypes[key.toLowerCase()] = new GraphQLObjectType({
		name: key,
		fields: fieldsThunk
	});


	queries[key.toLowerCase()] = {
		type: graphQLTypes[key.toLowerCase()],
		args: argsThunk,
		resolve: resolveThunk
	}


	mutations["add" + key] = {
		type: graphQLTypes[key.toLowerCase()],
    name: 'add' + key,
		args: {
      input: {
        type: new GraphQLInputObjectType({
          name: key + 'Input',
          fields: inputFieldsThunk
        })
      }
    },
		resolve: resolveAddThunk
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

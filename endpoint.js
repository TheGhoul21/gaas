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
const express = require('express');
const graphqlHTTP = require('express-graphql');

const app = express();

var TopicTypeFields =  {
	"id": {
		"type": "ID",
    "indexable":true,
	},
	"text": {
		"type": "String"
	},
	"pros": {
		"type": [
			"TopicFactor"
		]
	},
	"cons": {
		"type": [
			"TopicFactor"
		]
	},
	"user": {
		"type": "User"
	}
};

var TopicFactorTypeFields = {
	"id": {
		"type": "ID",
    "indexable":true,
	},
	"text": {
		"type": "String"
	}
};
var UserTypeFields = {
	"id": {
		"type": "ID",
    "indexable":true,
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


for (let [key, fields] of entries(types)) {

  let tempFields = {};
  let tempArgs = {};
  let _type;
  for(let [fieldName, config] of entries(fields)) {
    if(defaultTypes[config.type]) {
      tempFields[fieldName] = { type : defaultTypes[config.type], description: '............' };
      if(config.indexable)
        tempArgs[fieldName] = { type : defaultTypes[config.type] };
    }

  }


  graphQLTypes[key.toLowerCase()] = new GraphQLObjectType({
    name: key,
    fields: () => (tempFields)
  });


  schema[key.toLowerCase()] = {
    type: graphQLTypes[key.toLowerCase()],
    args: tempArgs,
    resolve: function(root, args) { return {id: args.id, text: "Mario"} }
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

app.listen(4000);

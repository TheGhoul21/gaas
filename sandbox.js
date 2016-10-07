import redis from 'redis';
import bluebird from 'bluebird';
import invariant from 'invariant';
import {btoa, atob} from './utils';
// import {types} from './endpoint';

var Schema = require('graph.ql')

import {
	GraphQLEnumType,
	GraphQLInterfaceType,
	GraphQLObjectType,
	GraphQLList,
	GraphQLNonNull,
	GraphQLSchema,
	GraphQLString,
	GraphQLBoolean,
	GraphqlFloat,
	GraphqlInt,
	GraphQLID,
  GraphQLInputObjectType
} from 'graphql/type';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let redisClient = redis.createClient();

export function parseType(type) {
	let required = false;
	let isArray = false;
	let returnType = { typeName : '', entityRelation: false };
	let charCode = -1;

	for(var i=0; i<type.length; i++) {
		charCode = type.charCodeAt(i);
		switch(charCode) {
			case 33: invariant(i == type.length -1, 'Unexpected token !');
				returnType.required = true;
				break;

			case 91: invariant(i == 0, 'Unexpected token ['); isArray = true; break;
			case 93: invariant(isArray, 'Unexpected token ]'); returnType.isArray = true; break;

			case 65: case 66: case 67: case 68: case 69: case 70: case 71: case 72:
			case 73: case 74: case 75: case 76: case 77: case 78: case 79: case 80:
			case 81: case 82: case 83: case 84: case 85: case 86: case 87: case 88:
			case 89: case 90:
			case 95:
			case 97: case 98: case 99: case 100: case 101: case 102: case 103: case 104:
			case 105: case 106: case 107: case 108: case 109: case 110: case 111:
			case 112: case 113: case 114: case 115: case 116: case 117: case 118:
			case 119: case 120: case 121: case 122:
			invariant(!(returnType.isArray || returnType.required), 'Unexpected token ' + type.charAt(i));

				returnType.typeName += type.charAt(i);
				break;

			case 45:
	    case 48: case 49: case 50: case 51: case 52:
	    case 53: case 54: case 55: case 56: case 57:
				invariant(!(returnType.isArray || returnType.required), 'Unexpected token ' + type.charAt(i));
				invariant(returnType.typeName != '', 'Cannot start type name with a number');

				returnType.typeName += type.charAt(i);
				break;
		}
	}

	if(!defaultTypes[returnType.typeName]) {
		returnType.entityRelation = true;
	}
	return returnType;
}

function describeEntity(entityName) {
	return redisClient.hgetallAsync(entityName + ':fields')
	.then(function(fields) {
		var realFields = [];
		for(var i in fields) {
			realFields.push({
				name: i,
				type: fields[i]
			});
		}
		return Promise.resolve({
			name: entityName,
			fields: realFields
		})
	})
}

export function getAllEntities() {
	let members = [];
	return redisClient.smembersAsync('Schema')
	.then(function(_members) {
		members = _members;
		let multi = redisClient.multi();
		for(var i in members) {
			multi.hgetallAsync(members[i] + ":fields");
		}

		return multi.execAsync();
	})
	.then(function(entityFields) {
		let entities = [];
		let fields;
		for(var j in entityFields) {
			fields = entityFields[j];

			var realFields = [];
			for(var i in fields) {
				realFields.push({
					name: i,
					type: fields[i]
				});
			}
			entities[j] = {
				name: members[j],
				fields: realFields
			};
		}

		return Promise.resolve(entities);
	})
	.catch(function(err) {
		console.error(err.stack);
	})
}

export var defaultTypes = {
	"String": GraphQLString,
	"ID": new GraphQLNonNull(GraphQLID),
  "Boolean": GraphQLBoolean,
	"Float": GraphqlFloat,
	"Int": GraphqlFloat,
}

let schema = Schema(`
type Field {
  name: String!
  type: String
  entity: Entity
}

type Entity {
  fields: [Field]
  name: String!
}

input FieldInput {
  name: String!,
  type: String!,
  entity: String
}

input EntityInput {
  name: String!
  fields: [FieldInput]
}

type Query {
  entity(name:String!): Entity
  field(name:String!): Field
  entities: [Entity]
  fields(entityName:String!): [Field]
}
type Mutation {
  addEntity(input: EntityInput!) :Entity
  addFieldToEntity(input: FieldInput!) :Entity
}
`, {
  Query: {
    entity(root, args) {

    },
    field(root, args) {
    },
    entities(root, args) {
      return getAllEntities();
    },
    fields(root, args) {
    }
  },
  Mutation: {
    addEntity(root, args) {
      let input = args.input;

      return redisClient
      .sismemberAsync('Schema', input.name)
      .then(function(isMember) {
        invariant(isMember === 0, 'Name already in use');
        return redisClient.saddAsync('Schema', input.name);
      })
			.then(function(result) {
				invariant(result, 'Error while adding schema');

				return redisClient.hmsetAsync(input.name + ':fields', {
					'id' : 'ID!'
				})
			})
      .then(function(result) {
        invariant(result, 'Error while adding id');
        return Promise.resolve(input);
      })
    },
    addFieldToEntity(root, args) {
      let input = args.input;
      return redisClient
      .sismemberAsync('Schema', input.entity)
			.then(function(isMember) {
        invariant(isMember === 1, 'Entity not found');
				return Promise.resolve(isMember);
      })
			.then(function(isMember) {

				// invariant(isMember == false, 'Field ' + input.name + ' already exists');
				let parsedType = parseType(input.type);
				if(defaultTypes[parsedType.typeName]) {
					return Promise.resolve(true);
				} else {
					return redisClient.sismemberAsync('Schema', parsedType.typeName);
				}
			})
			.then(function(result) {
				invariant(result, 'Invalid type for field ' + input.name);
				let key = input.name;
      	let object = {};
      	object[key] = input.type;
        return redisClient.hmsetAsync(input.entity + ':fields', object);
			})
      .then(function(result) {
        invariant(result, 'Error while adding field ' + input.name + " to " + input.entity);
        return redisClient.hgetallAsync(input.entity + ':fields' );
      })
      .then(function(fields) {
        var realFields = [];
        for(var i in fields) {
          realFields.push({
            name: i,
            type: fields[i]
          });
        }
        return Promise.resolve({
          name: input.entity,
          fields: realFields
        })
      })
			.catch(function(err) {
				return Promise.resolve(err);
			});


    }
  }
});
// schema(`
//   mutation($inputB:FieldInput!) {
// 		addFieldToEntity(input:$inputB){
// 			name,
// 			fields{
// 				name,
// 				type
// 			}
// 		}
// 	}
//   `,
//   {
//     inputA:{
//       name: "TopicFactor"
//     },
//     inputB: {
//       name: "username",
//       type: "String!",
//       entity:  "User"
//     }
//   })
//   .then(res => console.log(res));

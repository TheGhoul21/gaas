import { ObjectId} from 'mongodb';
import Schema from 'graph.ql';
import Field from './Field.js';
import graphqlHTTP from 'express-graphql';
import invariant from 'invariant';
import { connectionFromArray } from 'graphql-relay';
import {
	GraphQLEnumType,
	GraphQLInterfaceType,
	GraphQLObjectType,
	GraphQLList,
	GraphQLNonNull,
	GraphQLSchema,
	GraphQLString,
	GraphQLBoolean,
	GraphQLFloat,
	GraphQLInt,
	GraphQLID,
  GraphQLInputObjectType
} from 'graphql/type';

var Type = require('graph.ql/lib/generate');
var parse = require('graph.ql/lib/parse')

var _db;
class SchemaResolver {
  static defaultTypes = {
  	"String": GraphQLString,
  	"ID": new GraphQLNonNull(GraphQLID),
    "Boolean": GraphQLBoolean,
  	"Float": GraphQLFloat,
  	"Int": GraphQLInt,
  }
  static instance;
  db;
  request;
  constructor(db, {req,res,next}, appId) {
    this.db = db;
    this.request = req;
    _db = db;
    this.appId = appId;
    // this.query = new Query(db, appId);
    this.mutation = new Mutation(db, appId);
    this.query = new Query();
    if(req.session.user && req.session.user.apps) {
      if(req.session.user.apps.indexOf(appId) >= 0) {
        SchemaResolver.instance = this;
      } else {
        // res.send('There is no such app');
				return Promise.resolve({});
      }
    }
  }

	init() {
		var self = this;
		return this.db.collection('graphql').findOne({_id: ObjectId(this.appId)})
		.then(function(schema) {
			console.log(schema);
			var typeNames = [];
			for(var i in schema.schema) {
				typeNames.push(schema.schema[i].name);
			}
			return Promise.resolve(typeNames);
		})
		.then(function(typeNames) {
			let _schemaString = /*Schema*/[`
			enum FieldType { ` + typeNames.concat(Object.keys(SchemaResolver.defaultTypes)).join(', ') +`}
			enum EntityType { ` + typeNames.join(', ') +`}
			type Field implements SchemaNode {
				name: String!
				type: String
				isArray: Boolean
				isEntityType: Boolean
				inputRequired: Boolean
				outputRequired: Boolean
				entity: Entity
			}
			interface SchemaNode {
				name: String!
			}
			type Entity {
				fields(first: Int = 100, last: Int, after: String, before: String): FieldConnection
				name: String!
			}

			type FieldEdge {
			  cursor: String!
			  node: Field
			}
			type SchemaPageInfo {
			  hasNextPage: Boolean!
			  hasPreviousPage: Boolean!
			  startCursor: String
			  endCursor: String
			}

			type FieldConnection {
			  edges: [FieldEdge]
			  pageInfo: SchemaPageInfo
			}

			input FieldInput {
				name: String!
				type: FieldType!
				entity: EntityType!
				isArray: Boolean
				inputRequired: Boolean
				outputRequired: Boolean
				clientMutationId: String!
			}

			input FieldRemove {
				entity: EntityType!
				name: String!
			}
			input FieldEdit {
				entity: EntityType!
				name: String!
				isArray: Boolean
				inputRequired: Boolean
				outputRequired: Boolean
				clientMutationId: String!
			}

			input EntityInput {
				name: String!
				fields: [FieldInput]
				clientMutationId: String!
			}

			type Query {
				entity(name:String!): Entity
				field(name:String!): Field
				entities: [Entity]
				fields(entityName:String!): [Field]
			}

			type EntityOutput {
				clientMutationId: String!
				entity: Entity
			}

			type FieldOutput {
				clientMutationId: String!
				field: Field!
				entity: EntityType!
			}
			type Mutation {
				addEntity(input: EntityInput!) :EntityOutput
				addFieldToEntity(input: FieldInput!) :FieldOutput
				editFieldInEntity(input: FieldEdit!) :Entity
				removeFieldFromEntity(input: FieldRemove!) :Entity
			}
			`,{
				Field: {
					isEntityType(root, args) {
						return !SchemaResolver.defaultTypes[root.type]
					}
				},
				Entity: {
					fields(root, args) {
						return connectionFromArray(root.fields, args);
					}
				},
				SchemaNode: { resolveType() { console.log('resolveType', arguments); }},
				Query: /*SchemaResolver.getInstance().*/self.getQuery(),
				Mutation: /*SchemaResolver.getInstance().*/self.getMutation()
			}];

			var types = Type(parse(_schemaString[0]), _schemaString[1])
		  var object_types = types.objectTypes


			// return _schema;
			return object_types;
			// graphqlHTTP({schema: _schema.schema, graphiql: true})(req, res,next);
		}).catch(err => {console.error("error", this, err);})
	}

  getSchema() {
    return this.schema;
  }

  getQuery() {
    return this.query;
  }

  getMutation() {
    return this.mutation;
  }

  addEntity({name, fields, clientMutationId}) {

    if(fields) {
      for(var i in fields) {
        fields[i] = new Field(fields[i]).store();
      }
    }



    fields.push({
        "name" : "id",
        "type" : "ID",
        "inputRequired" : false,
        "outputRequired" : true,
        "isArray" : false
    });
    var appId = this.appId;

    let collection = this.db.collection('graphql');
    // return collection.then(function(result) {

      return collection.findOneAndUpdate({
        _id: ObjectId(appId),
				'schema.name': {
					$nin: [name]
				}
      },
      {
        $push: {
          "schema" :{
            name: name,
            fields: fields
          }
        }
      },
      {
        returnOriginal: false
      }
      )
    // })
    .then(function(result) {
				if(result.ok && result.value) {
					for(var i in result.value.schema) {
						if(result.value.schema[i].name == name) {
							return {
								entity: result.value.schema[i],
								clientMutationId: clientMutationId
							};
						}
					}
				} else {
					throw new Error("An entity with the same name already exists");
					// return null;
				}
    })
    .catch(function(error) {
      if(error.code == 11000) {
        // duplicate name
        throw new Error("An entity with the same name already exists");
      } else {
				throw error;
			}
    })
  }

  addFieldToEntity(field) {
    if(!field.entity) {
      throw new Error("Must specify the entity name when adding a new field");
    }
    let entityName = field.entity;
		let clientMutationId = field.clientMutationId;

    field = new Field(field).store();
    let collection = this.db.collection('graphql');
    var appId = this.appId;

    return collection
      .count({"schema.name": entityName, 'schema.fields.name': field.name})
      .then(function(count) {
        invariant(count == 0, 'A field with the same name already exists')
        return collection.findOneAndUpdate({
          _id: ObjectId(appId),
          'schema.name': entityName
        }, {
          $addToSet: {
            'schema.$.fields': field
          }
        }, {returnOriginal: false, returnNewDocument : true})
      })
      .then(function(result) {
        // for( var i in result.value.schema) {
        //   if(result.value.schema[i].name == entityName)
        //     return Promise.resolve(result.value.schema[i]);
        // }

				return {
						clientMutationId: clientMutationId,
						field: field,
						entity: entityName
				}
      })
  }

  editFieldInEntity(field) {
    if(!field.entity) {
      throw new Error("Must specify the entity name when adding a new field");
    }

    let entityName = field.entity;
    let fieldName = field.name;

    field = new Field(field).store();
    delete field.type;
    delete field.name;

    let updateObject = {};

    for(var i in field) {
      updateObject['fields.$.' + i] = field[i];
    }

    let collection = this.db.collection('_schema');

    return collection
      .count({name: entityName, 'fields.name': fieldName})
      .then(function(count) {
        invariant(count == 1, 'This field doesn\'t exist')
        return collection.findOneAndUpdate({
          name: entityName,
          'fields.name': fieldName
        }, {
          $set: updateObject
        },{returnOriginal: false, returnNewDocument : true})
      })
      .then(function(result) {
        return Promise.resolve(result.value);
      })
  }
  removeFieldFromEntity(field) {
    if(!field.entity) {
      throw new Error("Must specify the entity name when adding a new field");
    }
    let entityName = field.entity;

    field = new Field(field).store();
    let collection = this.db.collection('_schema');

    return collection
      .count({name: entityName, 'fields.name': field.name})
      .then(function(count) {
        invariant(count == 1, 'This field doesn\'t exist')
        return collection.findOneAndUpdate({
          name: entityName,
        }, {
          $pull: {
            fields: {
              name: field.name
            }
          }
        }, {returnOriginal: false, returnNewDocument : true})
      })
      .then(function(result) {
        return Promise.resolve(result.value);
      })
  }

  static getInstance() {
    return SchemaResolver.instance;
  }


}
class Query {
	entity(root, args) {
		return SchemaResolver.getInstance().db.collection('graphql')
			.findOne({_id: ObjectId(SchemaResolver.getInstance().appId)})
			.then((schema) => {
				for(var i in schema.schema) {
					if(schema.schema[i].name == args.name) {
						return schema.schema[i];
					}
				}
			});
	}

	field(root, args) {
	}

	entities(root, args) {
		return SchemaResolver.getInstance().db.collection('graphql')
			.findOne({_id: ObjectId(SchemaResolver.getInstance().appId)})
			.then((schema) => {
				return Object.values(schema.schema);
			});
	}

	fields(root, args) {
	}

	Node = {
		resolveType: function (obj, ctx, info) {
			console.log('mario');
		}
	}
}

class Mutation {
  constructor(schemaResolver) {
    this.schemaResolver = schemaResolver;
  }
  addEntity(root, args) {
    if(!args.input.fields) {
      args.input.fields = [];
    }
    return SchemaResolver.getInstance().addEntity(args.input);
  }
  addFieldToEntity(root, args) {
    return SchemaResolver.getInstance().addFieldToEntity(args.input);
  }
  editFieldInEntity(root, args) {
    return SchemaResolver.getInstance().editFieldInEntity(args.input);
  }
  removeFieldFromEntity(root, args) {
    return SchemaResolver.getInstance().removeFieldFromEntity(args.input);
  }
}



export default SchemaResolver;

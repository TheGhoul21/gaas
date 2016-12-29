import pluralize from 'pluralize';
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
import Field from './Field.js';
import { btoa, atob } from './utils';
import consolidate from 'consolidate';
import bcrypt from 'bcrypt-nodejs';
import {ObjectId} from 'mongodb';
import {connectionDefinitions, connectionArgs} from 'graphql-relay';
import connectionFromMongoCursor from 'relay-mongodb-connection';
import SchemaResolver from './SchemaResolver.js';
import graphqlHTTP from 'express-graphql';
import invariant from 'invariant';

class DataResolver {
  outputTypes = {};
  inputTypes = {};

  rootQueryFields = {};
  rootMutationFields = {};

  static defaultTypes = {
  	"String": GraphQLString,
  	"ID": new GraphQLNonNull(GraphQLID),
    "Boolean": GraphQLBoolean,
  	"Float": GraphQLFloat,
  	"Int": GraphQLFloat,
  }
  constructor(db, {req, res, next}, appId, entitySchema) {

    this.db = db;
    this.req = req;
    this.res = res;
    this.appId = appId;
		this.entitySchema = entitySchema;

    // this.generateGraphQLEndpoint();
  }

  init() {
    return this.db.collection('graphql')
    .findOne({_id: ObjectId(this.appId)})
    .then((schema) => {
      this.schema = schema.schema;
      return this.generateGraphQLEndpoint();
    });
  }

  getSchema() {
    return this.schema;
  }


  generateGraphQLEndpoint() {
    let outputType;
    let inputType;
    // let outputConnection;

    let queries = {};
    let mutations = {};
    let type = {};
    let inputArgs = {};
    let name;
    let fields
    let spec;

    let self = this;
    let idParam = {
      id: {
        type: new GraphQLNonNull(GraphQLID)
      }
    }

    let NodeInterface = new GraphQLInterfaceType({
    	name: 'Node',
    	fields: {
    		id: {
    			type: new GraphQLNonNull(GraphQLID)
    		}
    	},
    	resolveType: function(root, args) {

        return (self.outputTypes[self.decodeId(root.id).entityName + 'Type']);
    	}
    });

    this.rootQueryFields = {
    	node: {
    		type: NodeInterface,
    		args: {
    			id: {
    				type: new GraphQLNonNull(GraphQLID)
    			},
    		},
    		resolve: (root, args) => {
    			let decodedId = this.decodeId(args.id);
          let encodeId = this.encodeId;
          return this.db
          .collection(this.appId + ':' + decodedId.entityName)
          .findOne({_id: ObjectId(decodedId.id)})
          .then(function(result) {
            result.id = encodeId(decodedId.entityName, decodedId.id);
            return Promise.resolve(result);
          })
    		}
    	},
    };



    this.rootMutationFields = {};
    let types = this.getSchema();

		let typeNames = {};
    for(var i in types) {
			name = types[i].name;
			typeNames [name] = {value: name};
			fields = types[i].fields;
      // first for create output and input types based on the spec
			let fieldsThunk = this.getOutputFieldsThunk(name, fields);
			outputType = { name : name + 'Type', fields : fieldsThunk, interfaces: [NodeInterface] };
			this.outputTypes[outputType.name] = new GraphQLObjectType(outputType);

			var {connectionType: outputConnection} =
  			connectionDefinitions({nodeType: this.outputTypes[outputType.name]});

			this.outputTypes[name + 'Connection'] = outputConnection;



			this.rootQueryFields[pluralize(name, 1)] = {
				type: this.outputTypes[outputType.name],
				args: {
					id: {
						type: new GraphQLNonNull(GraphQLID)
					},
				},
				resolve: this.resolveEntity(name)
			}

			this.rootQueryFields[pluralize(name, 2)] = {
				type: this.outputTypes[name + 'Connection'],
				resolve: this.resolveConnection(name),
				args: connectionArgs
			}
      inputArgs = {};
      if( fields.length > 1) {
        inputType = { name : name + 'Input', fields: this.getInputFieldsThunk(name, fields) };
        this.inputTypes[inputType.name] = new GraphQLInputObjectType(inputType);
        inputArgs = {
					input: {
						type: new GraphQLNonNull(this.inputTypes[inputType.name])
					},
				};
      }
			this.rootMutationFields['Introduce' + pluralize(name, 1)] = {
				type: this.outputTypes[outputType.name],
				args: inputArgs,
				resolve: this.resolveAddThunk(name)
			}
			this.rootMutationFields['Update' + pluralize(name, 1)] = {
				type: this.outputTypes[outputType.name],
				args: Object.assign(inputArgs, idParam),
				resolve: this.resolveEditThunk(name)
			}


			for(var i in fields) {
        spec = new Field(fields[i]);
				let fieldName = pluralize(fields[i].name,1);
				let fieldNamePlural = pluralize(fields[i].name,2);
				if(spec.isEntityType) {
					let mutationName = "Add" + fieldName[0].toUpperCase() + fieldName.substring(1) + "To"+ name;
					this.rootMutationFields[mutationName] = {
						type: this.outputTypes[outputType.name],
						args: {
							input: {
								type: new GraphQLNonNull(new GraphQLInputObjectType({
									name: mutationName + 'Input',
                  fields: ((_spec) => () => ({
											_parent: {type: new GraphQLNonNull(GraphQLString)},
											_child: {type: GraphQLString},
											_childObject: {type: this.inputTypes[_spec.type + 'Input']}
										})
									)(spec)
								}))
							},
						},
						resolve: this.resolveAddRelationItemToParent(name, fields[i].name, spec)
					}

          this.rootQueryFields[pluralize(name, 2) + "By" + fieldName[0].toUpperCase() + fieldName.substr(1) ] = {
    				type: this.outputTypes[name + 'Connection'],//this.outputTypes[outputType.name],
    				args: Object.assign(connectionArgs, {
    					[!spec.isArray ? fieldName : fieldNamePlural]: {
    						type: GraphQLString
    					},
    				}),
    				resolve: this.resolveEntityByAttribute(name, !spec.isArray ? fieldName : fieldNamePlural, spec)
    			}

				} else {
          this.rootQueryFields[pluralize(name, 2) + "By" + fieldName[0].toUpperCase() + fieldName.substr(1) ] = {
    				type: this.outputTypes[name + 'Connection'],//this.outputTypes[outputType.name],
    				args: {
    					[fieldName]: {
    						type: SchemaResolver.defaultTypes[spec.type]
    					},
    				},
    				resolve: this.resolveEntityByAttribute(name, fieldName, spec)
    			}
        }
			}
		}

		var {connectionType: nodeConnection} =
			connectionDefinitions({nodeType: NodeInterface});

		var nodeArgs = connectionArgs;


		nodeArgs['entityName'] = {
			type: new GraphQLNonNull(new GraphQLEnumType({
				name:'NodeType',
				values: typeNames
			}))
		}
		this.rootQueryFields['nodes'] = {
			type: nodeConnection,
			resolve: this.resolveConnection(),
			// (root, args) => {
			// 	return this.resolveConnection(args.entityName)(root,args)
			// },
			args: nodeArgs
		};

		// let schemaQueryFields = this.entitySchema.schema._queryType._fields;
		// for(var i in schemaQueryFields) {
		// 	schemaQueryFields[i].deprecatedReason = '';
		// 	delete schemaQueryFields[i].isDeprecated;
		// };
		this.rootQueryFields['_schema'] = {
			type: this.entitySchema.schema.getQueryType(),
			resolve: () => ({})
		}
		this.rootMutationFields['_schema'] = {
			type: this.entitySchema.schema.getMutationType(),
			resolve: () => { console.log(arguments); return {addEntity: {}}; }
		}

    return Promise.resolve(graphqlHTTP({
      schema: new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          // fields: () => this.rootQueryFields
					fields: () => ({
						_schema: {
							type: this.entitySchema.schema.getQueryType(),
							resolve: () => ({})
						},
						node: this.rootQueryFields['node'],
						viewer: {
							type: new GraphQLObjectType({
								name: 'Viewer',
								fields: () => this.rootQueryFields
							}),
							resolve: () => ({})
						}
					})
        }),
        mutation: Object.keys(this.rootMutationFields).length > 0 ? new GraphQLObjectType({
          name: 'RootMutationType',
          fields: () => this.rootMutationFields
        }) : null,
        types: Object.assign(Object.keys(this.outputTypes).map(x => this.outputTypes[x]), {"NodeType":new GraphQLEnumType({
					values: typeNames
				})})
      }),
      graphiql: this.req.session.user.apps.indexOf(this.appId) >= 0
    }));

  }



  getOutputFieldsThunk(entityName, fields) {
  	return () => {
  		let tempOutputFields = {};

  		for(var i in fields) {
  			// spec = parseType(fields[i].type);
        let spec = new Field(fields[i]);
  			// spec.typeName, spec.required, spec.isArray
  			let type;
  			if(!spec.isEntityType) {
  				type = SchemaResolver.defaultTypes[spec.type];
  			} else {
  				type = this.outputTypes[spec.type + 'Type'];
  			}
  			if(spec.isArray) {
  				type = new GraphQLList(type);
  			}
  			if(spec.outputRequired && spec.type != 'ID') {
  				type = new GraphQLNonNull(type);
  			}
  			tempOutputFields[fields[i].name] = {
  				type: type,
  				resolve: this.fieldResolver(entityName, fields[i].name, spec)
  			};
  		}
  		return tempOutputFields;
  	}
  }

  getInputFieldsThunk(entityName, fields) {
  	return () => {
  		let tempInputFields = {};
  		for(var i in fields) {
  			let spec = new Field(fields[i]);
  			if(spec.type != 'ID' && !spec.isArray) {
  				// spec.type, spec.outputRequired, spec.isArray
  				let type;
  				if(!spec.isEntityType) {
  					type = SchemaResolver.defaultTypes[spec.type];
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

  resolveEntity = (name) => (root, args) => {

    return this.db.collection(this.appId + ':' + name)
    .findOne({_id: ObjectId(atob(args.id).split(':')[1])  })
  }
  resolveEntityByAttribute =
  (name, fieldName, spec) =>
  (root, args) => {
    return connectionFromMongoCursor(this.db.collection(this.appId + ':' + name)
        .find({[fieldName]: spec.isEntityType ? ObjectId(this.decodeId(args[fieldName]).id) : args[fieldName] }), args);

  }
  decodeId(id) {
    let decoded = atob(id).split(':');
    return {
      entityName: decoded[0],
      id: decoded[1],
    }
  }

  encodeId(entityName, id) {
    return btoa(entityName + ":" + id);
  }

  fieldResolver(entityName, fieldName, spec) {
    return (root, args) => {
      if(fieldName == 'id' && root._id) {
        return btoa(entityName + ":" + root._id);
      }
      if(spec.isEntityType) {
        let collection = this.db.collection(this.appId + ':' + spec.type);
        if(spec.isArray) {
          return root[fieldName] ? collection.find({_id: {$in: root[fieldName]}}).toArray() : [];
        } else {
          return root[fieldName] ? collection.findOne({_id: root[fieldName]}) : null;
        }
      }
      return root[fieldName]
    }
  }
  resolveThunk(entityName) {}
  resolveAddThunk(entityName) {
    return (root, args) => {
        let collection = this.db.collection(this.appId + ':' + entityName);

        if(!args.input) {
          args.input = {};
        }
        let decoded;
        for(var i in args.input) {

          decoded = this.decodeId(args.input[i])
          if(decoded.id && decoded.id.length == 24) {
            args.input[i] = ObjectId(decoded.id);
          }
        }

        delete args.id;
        return collection.insert(args.input)
        .then(function(result) {
          args.input.id = btoa(entityName + ':' + args.input._id);
          return Promise.resolve(args.input);
        })
    }
  }

  resolveEditThunk(entityName) {
    return (root, args) => {
        let collection = this.db.collection(this.appId + ':' + entityName);
        let _id = this.decodeId(args.id).id;

        return collection.findOneAndUpdate({ _id: ObjectId(_id) }, { $set: args.input }, {returnOriginal: false, returnNewDocument : true})
        .then(function(result) {
          invariant(result.lastErrorObject.n == 1, "Error during the update operation");
          return result.value;
        })
    }
  }
  resolveAddRelationItemToParent(entityName, fieldName, spec) {
    return (root, args) => {

      let collectionParent = this.db.collection(this.appId + ':' + entityName);
      let collectionChild;
      let childPromise;
      if(spec.isEntityType) {
        invariant(args.input._childObject || args.input._child, "At least one between _child and _childObject MUST be set");
        collectionChild = this.db.collection(this.appId + ':' + spec.type);
        if(args.input._childObject) {
          childPromise = collectionChild.insertOne(args.input._childObject)
        } else if(args.input._child) {
          childPromise = collectionChild.find({_id:args.input._child}).toArray().then((result) => invariant(result, "Child not found") && Promise.resolve({ insertedId: ObjectId(args.input._child) }));
        }
      } else {
        invariant(args.input._child && !args.input._childObject, 'When adding a non-entity field you MUST use the _child parameter');
        childPromise = Promise.resolve({ insertedId: args.input._child });
      }

      let parentId = {_id: ObjectId(args.input._parent)}
      return collectionParent.find(parentId)
      .toArray()
      .then(function(result) {
        return childPromise;
      })
      .then(function(result) {
        invariant(result.insertedId, 'Error adding child object');

        let updateObject = {};
        if(spec.isArray) {
          updateObject.$addToSet= {};
          updateObject.$addToSet[fieldName] = spec.isEntityType ? ObjectId(result.insertedId) : result.insertedId;
        } else {
          updateObject.$set= {};
          updateObject.$set[fieldName] = spec.isEntityType ? ObjectId(result.insertedId) : result.insertedId;
        }
        return collectionParent.updateOne(parentId, updateObject)
      })
      .then(function(result) {
        invariant(result.modifiedCount == 1, 'Error while adding _child to _parent');
        return collectionParent.findOne(parentId);
      })

    }
  }

	resolveConnection(entityName) {
		return (root, args, resolveInfo) => {
			if(args.entityName) {
				entityName = args.entityName;
			}
			var a = connectionFromMongoCursor(
				this.db.collection(this.appId + ':' + entityName).find({}),
				args,
				a => Object.assign(a, a.id = this.encodeId(entityName, a._id))
			);
			return a.catch(error => console.error(error.stack));
		};
	}

}

export default DataResolver;

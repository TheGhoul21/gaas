import {MongoClient, ObjectId} from 'mongodb';
import invariant from 'invariant';
import Schema from 'graph.ql';
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
	GraphqlFloat,
	GraphqlInt,
	GraphQLID,
  GraphQLInputObjectType
} from 'graphql/type';

import { btoa, atob } from './utils';
import consolidate from 'consolidate';
import swig from 'swig';
import bcrypt from 'bcrypt-nodejs';

import App from './src/components/App.jsx';
import React from 'react';
import ReactDOMServer from 'react-dom/server';


import {connectionDefinitions, connectionArgs} from 'graphql-relay';
import connectionFromMongoCursor from 'relay-mongodb-connection';


const express = require('express');
const graphqlHTTP = require('express-graphql');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);

const app = express();
const appEntities = express();
var bodyParser = require('body-parser')

app.use(express.static('public'));
app.use('/bower_components',  express.static(__dirname + '/bower_components'));
app.use('/jquery',  express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/semantic',  express.static(__dirname + '/semantic/dist'));
app.use('/dist',  express.static(__dirname + '/dist'));
app.use('/static',  express.static(__dirname + '/static'));


// let swig = consolidate.swig;

consolidate.requires.swig = swig;
consolidate.requires.swig.setFilter('path', function(path) {
	switch(path) {
		case 'user_login': return "/login"; break;
	}
})

app.engine('html.twig', consolidate.swig);

app.set('view engine', 'html.twig');
app.set('views', __dirname + '/views');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));



app.use(session({
    store: new RedisStore({}),
    secret: 'keyboard cat'
}));

app.get('/', function(req, res, next) {
	res.render('index');
});
app.get('/test', function(req, res, next) {
	res.render('test', {
		content: ReactDOMServer.renderToString(<App name="Mario"/>)
	});
});

app.use('/login', function(req, res,next) {



  if(req.method== "POST") {
    let email = req.body.email;
    let password = req.body.password;

    var url = 'mongodb://localhost:27017/gaas';
    MongoClient
      .connect(url)
      .then(function(db) {
        let collection = db.collection('tenants');
        collection
        .findOne({email: email})
        .then(function(user) {
          if(bcrypt.compareSync(password, user.password)) {
            req.session.user = user;
            res.redirect('/dashboard');
          } else {
            res.render('login', {
              title: 'Login',
              error: 'Bad credentials',
							path: function() {
								console.log(arguments);
							}
            });
          }

        })
        .catch(function(error) {
          console.error(error.stack);
        });
      });
    } else {
      res.render('login', {
        title: 'Login'
      });
    }
});


app.get(['/dashboard', '/dashboard/:appId', '/dashboard/:appId/:collectionName'], function(req, res, next) {

  var baseUrl = 'mongodb://localhost:27017/';


	let appId = req.params.appId;
	let collectionName = req.params.collectionName;
	let tempalateData = {title: 'Dashboard' };
	let schemaDB = null;
  MongoClient
    .connect(baseUrl + 'gaas')
    .then(function(db) {


      let collection = db.collection('tenants');
      collection
      .aggregate([
        {
          $match: {_id: ObjectId(req.session.user._id)},
        },
        {
          $unwind: '$apps'
        },
        {
          $lookup: {
          from: 'apps',
          localField: 'apps',
          foreignField: '_id',
          as: 'apps'
        }
      }])
      .next(function(err, docs) {
				tempalateData.apps = docs.apps;
				console.log(req.session.user.apps);
        if(appId) {
					if(req.session.user.apps.indexOf(appId) == -1) {
							appId = docs.apps[0];
					}
				}



				if(appId) {
					return MongoClient
					.connect(baseUrl + appId)
					.then(function(db) {
						schemaDB = db;
						return db.collection('_schema')
						.find({}, {name: 'name'})
						.toArray()
					})
					.then(function(result) {
						console.log("collections", result);
						if(result) {
							tempalateData.collections = result;
						}

						if(schemaDB) {
							if(!collectionName) {
								collectionName = 'User';
							}
							return schemaDB.listCollections().toArray()
							.then(function(items) {
								console.log("listCollections", items);
								var found = false;
									for(var i in items)  {
										if(items[i].name == collectionName) {
											found = true;
										}
									}

									if(!found) {
										collectionName = 'User';
									}

									return schemaDB.collection(collectionName)
									.find({}).toArray();
							})
							.then(function(items) {
								console.log("items", items);

								tempalateData.collectionData = items;
								return Promise.resolve(true);
							})

						}

						return Promise.resolve(false);
					})
					.then(function(result) {
						console.log("last promise", result);
						console.log("data", tempalateData);
						res.render('dashboard', tempalateData);
					})
					.catch(function(error) {
						console.error(error.stack);
					})




				}
				return Promise.resolve(false);

      })


      ;

    });


})

export default class AppSchema {
  static instance = null;
  db = null;
  initialized = false;

  schema = {};

  outputTypes = {};
  inputTypes = {};

  rootQueryFields = {};
  rootMutationFields = {};

  static defaultTypes = {
  	"String": GraphQLString,
  	"ID": new GraphQLNonNull(GraphQLID),
    "Boolean": GraphQLBoolean,
  	"Float": GraphqlFloat,
  	"Int": GraphqlFloat,
  }
  constructor(db) {
    invariant(db != null, 'Cannot initialize AppSchema without a valid connection to MongoDB');
    this.db = db;
  }
  static get(appId) {
    if(AppSchema.instance != null) {
      return Promise.resolve(AppSchema.instance);
    } else {
      var url = 'mongodb://localhost:27017/' + 'gaas';
      return MongoClient
        .connect(url)
        .then(function(db) {
          AppSchema.instance = new AppSchema(db);
          return AppSchema.instance.fetchSchema();
        })
        .then(function(db) {
          db.generateGraphQLEndpoint();
        })
        .then(function(result) {
          return Promise.resolve(AppSchema.instance);
        })
        .catch(function(error){
          console.error(error.stack);
        });
    }
  }

  addEntity({name, fields}) {

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

    let collection = this.db.collection('_schema');
    return collection.ensureIndex({name: 1}, {unique:true}).then(function(result) {
      return collection.insert({
        name: name,
        fields: fields
      })
    })
    .then(function(result) {
      return Promise.resolve(result.result.ok ? result.ops[0]: null)
    })
    .catch(function(error) {

      if(error.code == 11000) {
        // duplicate name
        throw new Error("An entity with the same name already exists");
      }
      console.error(error.stack);
    })
  }

  addFieldToEntity(field) {
    if(!field.entity) {
      throw new Error("Must specify the entity name when adding a new field");
    }
    let entityName = field.entity;

    field = new Field(field).store();
    let collection = this.db.collection('_schema');

    return collection
      .count({name: entityName, 'fields.name': field.name})
      .then(function(count) {
        invariant(count == 0, 'A field with the same name already exists')
        return collection.findOneAndUpdate({
          name: entityName
        }, {
          $push: {
            fields: field
          }
        }, {returnOriginal: false, returnNewDocument : true})
      })
      .then(function(result) {
        return Promise.resolve(result.value);
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

  fetchSchema() {
    var self = this;
    return this.db.collection('_schema').find({})
      .toArray()
      .then(function(entities) {
        self.schema = entities;

        for(var i in entities) {
          for(var j in entities[i].fields) {
            entities[i].fields[j] = new Field(entities[i].fields[j]);
          }
        }

        return Promise.resolve(self);
      })
  }




  getOutputFieldsThunk(entityName, fields) {
  	return () => {
  		let tempOutputFields = {};

  		for(var i in fields) {
  			// spec = parseType(fields[i].type);
        let spec = fields[i];
  			// spec.typeName, spec.required, spec.isArray
  			let type;
  			if(!spec.isEntityType) {
  				type = AppSchema.defaultTypes[spec.type];
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
  			let spec = fields[i];
  			if(/*spec.type != 'ID' && */!spec.isArray) {
  				// spec.type, spec.outputRequired, spec.isArray
  				let type;
  				if(!spec.isEntityType) {
  					type = AppSchema.defaultTypes[spec.type];
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

    return this.db.collection(name)
    .findOne({_id: ObjectId(atob(args.id).split(':')[1])  })
  }
  resolveEntityByAttribute =
  (name, fieldName, spec) =>
  (root, args) =>
  this.db.collection(name)
      .findOne({[fieldName]: spec.isEntityType ? ObjectId(this.decodeId(args[fieldName]).id) : args[fieldName] })


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

        let collection = this.db.collection(spec.type);
        if(spec.isArray) {
          return root[fieldName] ? collection.find({_id: {$in: root[fieldName]}}).toArray() : [];
        } else {
          return root[fieldName] ? collection.find({_id: root[fieldName]}) : null;
        }
      }
      return root[fieldName]
    }
  }
  resolveThunk(entityName) {}
  resolveAddThunk(entityName) {
    return (root, args) => {
        let collection = this.db.collection(entityName);

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
        let collection = this.db.collection(entityName);
        let _id = this.decodeId(args.input.id).id;
        delete args.input.id;

        return collection.findOneAndUpdate({ _id: ObjectId(_id) }, { $set: args.input }, {returnOriginal: false, returnNewDocument : true})
        .then(function(result) {
          invariant(result.lastErrorObject.n == 1, "Error during the update operation");
          return result.value;
        })
    }
  }
  resolveAddRelationItemToParent(entityName, fieldName, spec) {
    return (root, args) => {

      let collectionParent = this.db.collection(entityName);
      let collectionChild;
      let childPromise;
      if(spec.isEntityType) {
        invariant(args.input._childObject || args.input._child, "At least one between _child and _childObject MUST be set");
        collectionChild = this.db.collection(spec.type);
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
		console.log(entityName);
		return (root, args, resolveInfo) => {
			console.log(args, entityName);
			var a = connectionFromMongoCursor(
				this.db.collection(entityName).find({}),
				args
			);
			return a.catch(error => console.error(error.stack));
		};
	}

  generateGraphQLEndpoint() {
    let outputType;
    let inputType;
    // let outputConnection;

    let queries = {};
    let mutations = {};
    let type = {};

    let name;
    let fields
    let spec;

    // let this.outputTypes = {};
    // let this.inputTypes = {};

    let self = this;

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
          .collection(decodedId.entityName)
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

			inputType = { name : name + 'Input', fields: this.getInputFieldsThunk(name, fields) };
			this.inputTypes[inputType.name] = new GraphQLInputObjectType(inputType);

			this.rootQueryFields[pluralize(name, 1)] = {
				type: this.outputTypes[outputType.name],
				args: {
					id: {
						type: new GraphQLNonNull(GraphQLID)
					},
				},
				resolve: this.resolveEntity(name)
			}
			console.log(outputConnection.name);

			// console.log(this.outputTypes[outputType.name + 'Connection']);
			this.rootQueryFields[pluralize(name, 2)] = {
				type: this.outputTypes[name + 'Connection'],
				resolve: this.resolveConnection(name),
				args: connectionArgs
			}

			this.rootMutationFields['Introduce' + pluralize(name, 1)] = {
				type: this.outputTypes[outputType.name],
				args: {
					input: {
						type: new GraphQLNonNull(this.inputTypes[inputType.name])
					},
				},
				resolve: this.resolveAddThunk(name)
			}
			this.rootMutationFields['Update' + pluralize(name, 1)] = {
				type: this.outputTypes[outputType.name],
				args: {
					input: {
						type: new GraphQLNonNull(this.inputTypes[inputType.name])
					},
				},
				resolve: this.resolveEditThunk(name)
			}


			for(var i in fields) {
        spec = fields[i];
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
          this.rootQueryFields[pluralize(name, 1) + "By" + fieldName[0].toUpperCase() + fieldName.substr(1) ] = {
    				type: this.outputTypes[outputType.name],
    				args: {
    					[!spec.isArray ? fieldName : fieldNamePlural]: {
    						type: GraphQLString
    					},
    				},
    				resolve: this.resolveEntityByAttribute(name, !spec.isArray ? fieldName : fieldNamePlural, spec)
    			}

				} else {
          this.rootQueryFields[pluralize(name, 1) + "By" + fieldName[0].toUpperCase() + fieldName.substr(1) ] = {
    				type: this.outputTypes[outputType.name],
    				args: {
    					[fieldName]: {
    						type: AppSchema.defaultTypes[spec.type]
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
			type: new GraphQLEnumType({
				values: typeNames
			})
		}
		this.rootQueryFields['nodes'] = {
			type: nodeConnection,
			// resolve: (root, args) => {
			// 	var a = Promise.resolve(this.resolveConnection(args.entityName)(root, args))
			// 	console.log(Promise.resolve(a).then((r) => r ));
			// 	return a;
			// },

			resolve: (root, args) => this.resolveConnection(args.entityName)(root,args),
			args: nodeArgs
		};

		return Promise.resolve([this.rootQueryFields, this.rootMutationFields]);
  }

  getSchema() {
    return this.schema;
  }
}

export function start(appId) {
  return AppSchema.get(appId).then(appSchema => {
    let schema = Schema(`
    type Field {
      name: String!
      type: String
      isArray: Boolean
      isEntityType: Boolean
      inputRequired: Boolean
      outputRequired: Boolean
      entity: Entity
    }

    type Entity {
      fields: [Field]
      name: String!
    }

    input FieldInput {
      name: String!
      type: String!
      entity: String
      isArray: Boolean
      inputRequired: Boolean
      outputRequired: Boolean
    }

    input FieldRemove {
      entity: String!
      name: String!
    }
    input FieldEdit {
      entity: String!
      name: String!
      isArray: Boolean
      inputRequired: Boolean
      outputRequired: Boolean
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
      editFieldInEntity(input: FieldEdit!) :Entity
      removeFieldFromEntity(input: FieldRemove!) :Entity
    }
    `, {
      Query: {
        entity(root, args) {
					const _schema = appSchema.getSchema();

					for(var i in _schema) {
						if(_schema[i].name == args.name) {
							return _schema[i];
						}
					}
        },
        field(root, args) {
        },
        entities(root, args) {
          return appSchema.getSchema();
        },
        fields(root, args) {
        }
      },
      Mutation: {
        addEntity(root, args) {
          if(!args.input.fields) {
            args.input.fields = [];
          }
          return appSchema.addEntity(args.input);
        },
        addFieldToEntity(root, args) {
          return appSchema.addFieldToEntity(args.input);
        },
        editFieldInEntity(root, args) {
          return appSchema.editFieldInEntity(args.input);
        },
        removeFieldFromEntity(root, args) {
          return appSchema.removeFieldFromEntity(args.input);
        }
      }
    });
    // schema('mutation {  editFieldInEntity(input: {entity:"Topic", name: "user", outputRequired: false}) { name, fields { name, type, inputRequired, outputRequired, isArray }} }').then(result => console.log(result));
    // schema('mutation {  addFieldToEntity(input: {entity:"Topic", type: "TopicFactor", name: "pros", isArray: true}) { name, fields { name, type, inputRequired, outputRequired, isArray }} }').then(result => console.log(result));

    app.use('/graphql/schema', isAuthenticated, graphqlHTTP({schema: schema.schema, graphiql: true}));
    // app.get('/schema', function(result){
    //   console.log(result);
    // });

    app.use('/graphql/data', graphqlHTTP({
      schema: new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'RootQueryType',
          fields: () => appSchema.rootQueryFields
        }),
        mutation: Object.keys(appSchema.rootMutationFields).length > 0 ? new GraphQLObjectType({
          name: 'RootMutationType',
          fields: () => appSchema.rootMutationFields
        }) : null,
        types: Object.keys(appSchema.outputTypes).map(x => appSchema.outputTypes[x])
      }),
      graphiql: true
    }));
  })
  .catch(function(error) {
    console.error(error.stack);
  });
}

function isAuthenticated(req, res, next) {

    // do any checks you want to in here

    // CHECK THE USER STORED IN SESSION FOR A CUSTOM VARIABLE
    // you can do this however you want with whatever variables you set up
    if (req.session.user)
        return next();

    // IF A USER ISN'T LOGGED IN, THEN REDIRECT THEM SOMEWHERE
    res.redirect('/');
}


app.listen(3001);
console.log("secondary endpoint listening on port 3001");

class Field {
  isArray = false;
  type = "";
  isEntityType = false;
  hidden = false;

  inputRequired = false;
  outputRequired = false;

	unique = false;

  name = "";

  constructor(configMap) {
    this.name = configMap.name || this.name;
    this.type = configMap.type || this.type;
    this.inputRequired = configMap.inputRequired || this.inputRequired;
    this.outputRequired = configMap.outputRequired || this.outputRequired;
    this.isArray = configMap.isArray || this.isArray;
    this.hidden = configMap.hidden || this.hidden;
    this.isEntityType = AppSchema.defaultTypes[this.type] ? false : true;
		this.unique = configMap.unique || this.unique;
  }

  store() {
    return {
        "name" : this.name,
        "type" : this.type,
        "inputRequired" : this.inputRequired,
        "outputRequired" : this.outputRequired,
        "isArray" : this.isArray,
				"unique": this.unique
    }
  }

  // getType(db) {
  //   return this.isEntityType ?
  // }
}

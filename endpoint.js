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

import {AppSchema, start} from './AppSchema';
var appId = 'test';
start(appId).then(function() {
	console.log("graphql endpoint for appId: " + appId + " started correctly");
})

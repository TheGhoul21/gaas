var MongoClient = require('mongodb').MongoClient,
assert = require('assert');
var debug = require('debug');
import subdomain from 'express-subdomain';

import {ObjectId} from 'mongodb';

import SchemaResolver from './SchemaResolver.js';
import DataResolver from './DataResolver.js';

const graphqlHTTP = require('express-graphql');

import consolidate from 'consolidate';
import swig from 'swig';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

// import AppRouter from './src/app.jsx';


// var url = 'mongodb://' + user + ':' + password + '@ds029446.mlab.com:29446/graphql';
var url = 'mongodb://localhost:27017/gaas';
var db;
// Use connect method to connect to the server
MongoClient.connect(url, function(err, _db) {
  assert.equal(null, err);
  debug('mongo')('connected successfully');
  db = _db;
  startEndpoint();
});

function startEndpoint() {
  const express = require('express');
  const graphqlHTTP = require('express-graphql');
  var session = require('express-session');
  var RedisStore = require('connect-redis')(session);

  const app = express();
  var bodyParser = require('body-parser')

  debug('mongo')('setting up static resources');
  app.use(express.static('public'));
  app.use('/bower_components',  express.static(__dirname + '/bower_components'));
  app.use('/jquery',  express.static(__dirname + '/node_modules/jquery/dist'));
  app.use('/semantic',  express.static(__dirname + '/semantic/dist'));
  app.use('/dist',  express.static(__dirname + '/dist'));
  app.use('/static',  express.static(__dirname + '/static'));


  app.engine('html.twig', consolidate.swig);

  app.set('view engine', 'html.twig');
  app.set('views', __dirname + '/views');


  app.use(session({
      store: new RedisStore({}),
      secret: 'keyboard cat',
      cookie: {
        domain: '.gaas.localhost'
      }
  }));

  app.get('/populate-session', (req,res,next) => {
    db.collection('tenants').findOne({_id: ObjectId('58162d85f3c6823a39a4c04c')}).then(user => {

      console.log(user);
      req.session.user = user;

      next();
    })
  });

  app.get('/test', (req, res, next) => {
    console.log(req.session.user);
    next();
  });



  var router = express.Router();

  router.use('/schema', function(req, res, next) {
    var appId = req.headers.host.split(".")[0];
    new SchemaResolver(db, {req, res, next}, appId);
  });

  router.use('/graphql', function(req, res, next) {
    var appId = req.headers.host.split(".")[0];
    new SchemaResolver(db, {req, res, next}, appId)
    .init()
    .then((entitySchema) => {

      new DataResolver(db, {req, res, next}, appId, entitySchema).init().then((endpoint) => {
        require('debug')('graphql')('Endpoint created');
        endpoint(req, res, next);
      }).catch(error => {console.log(error.stack)});
    }).catch(error => {console.log(error.stack)});
  });

  router.use('*', (req,res, next) => {
    // var renderedData = ReactDOMServer.renderToString(<AppRouter />);
    res.render('app', {content: ''})
  })

  app.use(subdomain('*', router));



  app.listen(3001);
}

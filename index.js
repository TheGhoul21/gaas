var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');

var password = encodeURIComponent('wiYXkV$Zd$3!%nNs3n#4');
var user = 'test';
// Connection URL
var url = 'mongodb://' + user + ':' + password + '@ds029446.mlab.com:29446/graphql';

// Use connect method to connect to the server
MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  findDocuments(db, function() {
     db.close();
   });
});


var findDocuments = function(db, callback) {
  // Get the documents collection
  var collection = db.collection('documents');
  // Find some documents
  collection.find({}).toArray(function(err, docs) {
    assert.equal(err, null);
    console.log("Found the following records");
    console.log(docs)
    callback(docs);
  });
}

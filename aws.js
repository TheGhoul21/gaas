import AWS from 'aws-sdk';
import fs from 'fs';
AWS.config.update({
  region: "us-west-2",
  endpoint: "http://localhost:8001"
});

let dynamoDB = new AWS.DynamoDB();

var docClient = new AWS.DynamoDB.DocumentClient();

var params = {
    TableName : "Movies",
    ProjectionExpression:"#yr, title, info.genres, info.actors[0]",
    KeyConditionExpression: "#yr between :start_year and :end_year and title between :letter1 and :letter2",
    ExpressionAttributeNames:{
        "#yr": "year"
    },
    ExpressionAttributeValues: {
        ":start_year":1992,
        ":end_year":1997,
        ":letter1": "A",
        ":letter2": "L"
    }
};

docClient.query(params, function(err, data) {
    if (err) {
        console.log("Unable to query. Error:", JSON.stringify(err, null, 2));
    } else {
        console.log("Query succeeded.");
        data.Items.forEach(function(item) {
            console.log(" -", item.year + ": " + item.title
            + " ... " + item.info.genres
            + " ... " + item.info.actors[0]);
        });
    }
});

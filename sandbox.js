import redis from 'redis';
import bluebird from 'bluebird';

import {btoa, atob} from './utils';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let redisClient = redis.createClient();
let input = {
  topic: "dG9waWM6MQ==",
  text: "pro-1"
};
function cb(id) {
  console.log(id);
  let createdAt = new Date().getTime();
  let multi = redisClient.multi();
  input.id = btoa("topicfactor:" + id);
  let parentId = atob(input.topic);
  let relationName = 'pros';
  multi.hmset("topicfactor:" + id, input);
  multi.zadd(relationName + ":" + parentId, createdAt, "topicfactor:" + id);
  multi.hgetall("topicfactor:" + id);
  return multi.execAsync()
}

let promise = Promise.resolve(redisClient.incrAsync('topicfactor:nextId').then(cb));

promise.then(function() {
  console.log(arguments);
}).catch(function(err) {
  console.log(err);
});


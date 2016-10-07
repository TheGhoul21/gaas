import redis from 'redis';
import bluebird from 'bluebird';
import pluralize from 'pluralize';

import {btoa, atob} from './utils';
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let redisClient = redis.createClient();

export function fieldResolver(entityName, fieldName, spec) {

  if(spec.typeName == 'ID') {
    return (obj) => btoa(obj[fieldName]);
  }
  if(spec.entityRelation == false) {
    return (obj) => obj[fieldName];
  }
  if(spec.isArray) {
    return (obj) => {
      return redisClient.zrangeAsync(obj.id + ':' + fieldName,1,-1)
      .then(function(ids) {
        let multi = redisClient.multi();

        for(var i in ids) {
          multi.hgetallAsync(ids[i])
        }

        return multi.execAsync();
      })
    }
  } else {
    return (obj) => Promise.resolve(redisClient.hgetallAsync(obj[fieldName]))
  }
}
function resolveEntity(id) {
  return redisClient
    .hgetallAsync(id)
    .then(function(object) {
      return Promise.resolve(object)
    });
}

export function entityResolver() {
  return (root, args) => resolveEntity(atob(args.id));

}
export function resolveThunk(key) {
  return (root, args) => {
    let value = Promise.resolve(redisClient.hgetallAsync(args.id));
    return value;
  }
}

export const resolveAddThunk = (entityName) => (root, args) => {
  return redisClient.incrAsync(entityName + "Id")
  .then((id) => {
    args.input.id = entityName.toLowerCase() + ":" + id;
    redisClient.hmset(args.input.id, args.input);
    return Promise.resolve(args.input);
  })
}

export const resolveAddRelationItemToParent = (entityName, fieldName, spec) => (root, args) => {
  if(spec.isArray) {
    return redisClient
    .zaddAsync([atob(args.input._parent) + ':' + fieldName, 'NX', +new Date(), atob(args.input._child)])
    // .then(function(result) {
    //   console.log(result);
    //   return resolveEntity(atob(args.input._parent))
    // });
    .then((result) => resolveEntity(atob(args.input._parent)))
  } else {
    return redisClient.hsetAsync(atob(args.input._parent), {fieldName: args.input._child});
  }
}

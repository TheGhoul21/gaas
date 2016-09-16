import redis from 'redis';
import bluebird from 'bluebird';

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

let redisClient = redis.createClient();

export function fieldResolver(fieldName, config) {
  // if(config.relation) {
  //   switch (config.relation.type) {
  //     case 'OneToMany':
  //
  //
  //
  //     break;
  //
  //
  //   }
  // } else {
    return (obj) => Promise.resolve(redisClient.hgetallAsync(obj[fieldName]))
  // }
}

export function resolveThunk(key) {
  return (root, args) => {
    let value = Promise.resolve(redisClient.hgetallAsync(args.id));
    return value;
  }
}

export const resolveAddThunk = (key) => (root, args) => {
  return Promise.resolve(redisClient.incrAsync(key+"Id").then((id) => {
    args.input.id = btoa(key.toLowerCase() + ":" + id);
    redisClient.hmset(args.input.id, args.input);
    return args.input;
  }))
}

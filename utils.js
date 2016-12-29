export function btoa(str) {
  return new Buffer(str).toString('base64');
}
export function atob(base64) {
  return new Buffer(base64, 'base64').toString('ascii');
}

export function decodeId(id) {
  let decoded = atob(id).split(':');
  return {
    entityName: decoded[0],
    id: decoded[1],
  }
}

export function encodeId(entityName, id) {
  return btoa(entityName + ":" + id);
}

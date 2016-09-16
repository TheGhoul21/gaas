export function btoa(str) {
  return new Buffer(str).toString('base64');
}
export function atob(base64) {
  return new Buffer(base64, 'base64').toString('ascii');
}
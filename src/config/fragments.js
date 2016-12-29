let queries = {};

export function getTypes(schemaJson) {
  let types = schemaJson.__schema.types;
  let type;

  let entityNames = [];
  for(var i in types) {
    type = types[i];
    if('NodeType' == type.name) {
      for(var j in type.enumValues) {
        entityNames.push(type.enumValues[j].name + 'Type');
      }
    }
  };
  let fields;
  for(var i in types) {
    type = types[i];
    fields = [];
    if(entityNames.indexOf(type.name) >= 0) {
      fields = [];
      for(var j in type.fields) {
        fields.push(type.fields[j].name);
      }
      fields = fields.join("\n\t");
      queries[type.name] = `
fragment on ${type.name} {
    ${fields}
}
      `;
    }
  }
}

export default queries;

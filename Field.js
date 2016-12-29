import SchemaResolver from './SchemaResolver.js';
class Field {
  isArray = false;
  type = "";
  isEntityType = false;
  hidden = false;

  inputRequired = false;
  outputRequired = false;

	unique = false;

  name = "";

  constructor(configMap) {
    this.name = configMap.name || this.name;
    this.type = configMap.type || this.type;
    this.inputRequired = configMap.inputRequired || this.inputRequired;
    this.outputRequired = configMap.outputRequired || this.outputRequired;
    this.isArray = configMap.isArray || this.isArray;
    this.hidden = configMap.hidden || this.hidden;
    this.isEntityType = SchemaResolver.defaultTypes[this.type] ? false : true;
		this.unique = configMap.unique || this.unique;
  }

  store() {
    return {
        "name" : this.name,
        "type" : this.type,
        "inputRequired" : this.inputRequired,
        "outputRequired" : this.outputRequired,
        "isArray" : this.isArray,
				"unique": this.unique
    }
  }
}

export default Field;

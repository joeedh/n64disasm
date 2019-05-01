export var config = {
  loadJSON : function(obj) {
    for (let k in obj) {
      if (!(k in this)) {
        console.log("unknown config key", k);
        continue;
      }
      
      this[k] = obj[k];
    }
    
    return this;
  }
};
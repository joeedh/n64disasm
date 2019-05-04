export var StructTypes = {
  INT32 : (1<<0),
  INT16 : (1<<1),
  INT8 : (1<<2),
  FLAG : (1<<3),
  UINT32 : (1<<4),
  UINT16 : (1<<5),
  UINT8 : (1<<6),
  FLOAT32 : (1<<7),
  FLOAT64 : (1<<8),
  POINTER : (1<<9),
  FUNCTION : (1<<10),
  ARRAY : (1<<11),
  STRUCT : (1<<12),
  FIELD : (1<<13) //bit field
}

let INT32 = StructTypes.INT32,
    INT16 = StructTypes.INT16,
    INT8 = StructTypes.INT8,
    UINT32 = StructTypes.UINT32,
    UINT16 = StructTypes.UINT16,
    UINT8 = StructTypes.UINT8,
    FLOAT32 = StructTypes.FLOAT32,
    FLOAT64 = StructTypes.FLOAT64,
    STRUCT = StructTypes.STRUCT,
    ARRAY = StructTypes.ARRAY,
    POINTER = StructTypes.POINTER,
    FUNCTION = StructTypes.FUNCTION,
    FLAG = StructTypes.FLAG,
    FIELD = StructTypes.FIELD;
    
let value_typemap = {
  [POINTER] : 32,
  [INT32] : 32,
  [INT16] : 16,
  [INT8] : 8,
  [FLAG] : 1,
  [UINT32] : 32,
  [UINT16] : 16,
  [UINT8] : 8,
  [FLOAT32] : 32,
  [FLOAT64] : 64,
}

export function warning(msg) {
  console.log(msg);
}

//returns size in bytes
export function typesize(type) {
  if (type.type == FIELD) {
    return type.size;
  }
  
  if (type.type in value_typemap) {
    return value_typemap[type.type]>>3;
  }
}

export class Type {
  constructor(type, data, name, parent) {
    this.type = type;
    this.data = data;
    this.parent = parent;
    this.name = name;
    this.comment = "";
    this.size = 1; //array size
  }
  
  toJSON() {
    let data = this.data;
    
    if (data instanceof Struct) {
      data = data.id;
    }
    
    return {
      type : this.type,
      data : data,
      name : this.name,
      comment : this.comment,
      size : this.size
    }
  }
  
  loadJSON(obj) {
    this.type = obj.type;
    this.data = obj.data;
    this.name = obj.name;
    this.size = obj.size;
    this.comment = obj.comment !== undefined ? obj.comment : "";
    
    if (typeof this.data == "object") {
      let data = new Type();
      data.parent = this;
      
      data.loadJSON(this.data);
      this.data = data;
    }
    
    return this;
  }
  
  link(structman) {
    switch (this.type) {
      case StructTypes.STRUCT:
        if (this.data !== undefined) {
          this.data = structman.idmap[this.data];
        }
        break;
      case StructTypes.POINTER:
        if (this.data !== undefined) {
          this.data.link(structman);
        }
        break;
      case StructTypes.ARRAY:
        if (this.data !== undefined) {
          this.data.link(structman);
        }
        break;
      default:
        break;
    }
  }
}

export var StructFlags = {
};

var u8buf = new Uint8Array(8);
var f32buf = new Float32Array(u8buf.buffer);
var f64buf = new Float64Array(u8buf.buffer);

export class StructMember extends Type {
  constructor(type, data, name, parent) {
    super(type, data, name, parent);
    this.flag = 0;
    this.startbit = -1;
    this.name = name;
  }
  
  read_basic_type(uint8array, ptr) {
    let mem = uint8array;
    let start = this.startbit>>3;
    
    function readint(ptr, size, signed) {
      let ret = 0;
      let shift = 0;
      
      for (let i=size-1; i>=0; i--) {
        ret |= mem[ptr+i]<<shift;
        shift += 8;
      }
      
      if (signed && ret >= Math.pow(2, size*4-1)) {
        ret = Math.pow(2, size*4-1) - ret;
      } else if (!signed && size == 4) {
        if (ret & (1<<31)) {
          ret += Math.pow(2, 31);
        }
      }
      
      return ret;
    }
    
    if (this.type == StructTypes.FLAG) {
      let b = this.startbit>>3;
      let i = this.startbit & 7;
      
      return mem[ptr + b] & i;
    } else if (this.type == StructTypes.POINTER) {
      return readint(ptr+start, 4, false);
    } else if (this.type == StructTypes.UINT8) {
      return mem[ptr+start];
    } else if (this.type == StructTypes.UINT16) {
      return readint(ptr+start, 2, false);
    } else if (this.type == StructTypes.INT16) {
      return readint(ptr+start, 2, true);    
    } else if (this.type == StructTypes.UINT32) {
      return readint(ptr+start, 4, false);
    } else if (this.type == StructTypes.INT32) {
      return readint(ptr+start, 4, true);    
    } else if (this.type == StructTypes.FLOAT32) {
      for (let i=0; i<4; i++) {
        u8buf[3-i] = mem[ptr+start+i];
      }
      
      return f32buf[0];
    } else if (this.type == StructTypes.FLOAT64) {
      for (let i=0; i<8; i++) {
        u8buf[7-i] = mem[ptr+start+i];
      }
      
      return f64buf[0];
    }
  }
  
  
  loadJSON(obj) {
    super.loadJSON(obj);
    
    this.id = obj.id;
    this.flag = obj.flag;
    this.name = obj.name;
    this.startbit = obj.startbit;
    
    return this;
  }
  
  toJSON() {
    let ret = {
      flag : this.flag,
      id : this.id,
      name : this.name,
      startbit : this.startbit
    };
    
    return Object.assign(super.toJSON(), ret);
  }
}

export class Struct {
  constructor(members) {
    this.members = [];
    this.namemap = {};
    this.idmap = {};
    this.idgen = 1;
    this.flag = 0;
    this.id = -1;
    
    this.name = "unnamed";
    
    if (members !== undefined) {
      for (let m in members) {
        this.add(m);
      }
    }
  }
  
  add(m) {
    m.id = this.idgen++;
    
    this.idmap[m.id] = m;
    this.namemap[m.name] = m;
    this.members.push(m);
  }
  
  _makebasic(type, name) {
    let ret = new StructMember(type, undefined, name, this);
    
    this.add(ret);
    
    return ret;
  }
  
  int32(name) {
    return this._makebasic(StructTypes.INT32, name);
  }
  int16(name) {
    return this._makebasic(StructTypes.INT16, name);
  }
  int8(name) {
    return this._makebasic(StructTypes.INT8, name);
  }
  
  uint32(name) {
    return this._makebasic(StructTypes.UINT32, name);
  }
  uint16(name) {
    return this._makebasic(StructTypes.UINT16, name);
  }
  uint8(name) {
    return this._makebasic(StructTypes.UINT8, name);
  }
  
  float32(name) {
    return this._makebasic(StructTypes.FLOAT32, name);
  }
  float64(name) {
    return this._makebasic(StructTypes.FLOAT64, name);
  }

  field(name, type, size) {
    let ret = new StructMember(StructTypes.FIELD, type, name, this);
    this.add(ret);
    return ret;
  }
  
  array(name, type, size) {
    let ret = new StructMember(StructTypes.ARRAY, type, name, this);
    this.add(ret);
    return ret;
  }
  
  struct(name, st) {
    let ret = new StructMember(StructTypes.STRUCT, type, name, this);
    this.add(ret);
    return ret;
  }
  
  pointer(name, type) {
    if (typeof type == "object" && type instanceof Struct) {
      type = new Type(StructTypes.STRUCT, type);
    }
    
    let ret = new StructMember(StructTypes.ARRAY, type, name, this);
    this.add(ret);
  }
  
  calcSize() {
    let bi = 0;
    this._incalc = 1;
    
    let recurse = (type) => {
      if (type.type in value_typemap) {
        let sz = value_typemap[type.type];
        bi += sz;
        
        //enforce alignment
        if (bi % sz != 0) {
          bi = bi - (bi % sz) + sz;
        }
      } else if (type.type & (POINTER|FUNCTION)) {
        if (bi & 32) { //pad alignment
          bi = bi - (bi & 31) + 32;
        }
      } else if (type.type == ARRAY) {
        let start = bi;
        recurse(type.data);
        
        bi = start + (bi - start)*type.size;
      } else if (type.type == STRUCT) {
        if (type.data === this) {
          throw new Error("structs cannot contain themselves except as pointers");
        }
        
        type.data.calcSize();
        bi += type.data.size;
      } else if (type.type == StructTypes.ARRAY && type.data !== undefined) {
        for (let i=0; i<type.size; i++) {
          recurse(type.data);
        }
      } else if (type.type == FIELD) {
        bi += type.size;
      }
    }
    
    for (let m of this.members) {
      m.startBit = bi;
      
      recurse(m);
    }
    
    this._incalc = 0;
    this.size = bi;
  }
  
  link(structman) {
    for (let m of this.members) {
      
      m.link(structman);
    }
  }
  
  toJSON() {
    return {
      name : this.name,
      id : this.id,
      idgen : this.idgen,
      members : this.members,
      flag : this.flag
    };
  }
  
  loadJSON(obj) {
    this.idmap = {};
    this.namemap = {};
    this.members.length = 0;
    this.name = obj.name;
    
    this.idgen = obj.idgen;
    this.id = obj.id;
    this.flag = obj.flag;
    
    for (let m of obj.members) {
      let m2 = new StructMember();
      m2.loadJSON(m);
      
      this.members.push(m2);
      this.namemap[m2.name] = m2;
      this.idmap[m2.id] = m2;
    }
    
    return this;
  }
}

export class StructManager extends Array {
  constructor() {
    super();
    
    this.idmap = {};
    this.namemap = {};
    
    this.idgen = 1;
    this._push = this.push;
    this.push = undefined;
  }
  
  add(st) {
    st.id = this.idgen++;
    
    this.namemap[st.name] = st;
    this.idmap[st.id] = st;
    
    this._push(st);
  }
  
  loadJSON(obj) {
    if (obj.structs === undefined) {
      return this;
    }
    
    this.idgen = obj.idgen;
    
    for (let i=0; i<obj.structs.length; i++) {
      let st = obj.structs[i];
      let st2 = new Struct();
      
      st2.parent = this;
      st2.loadJSON(st);
      
      this.idmap[st2.id] = st2;
      this.namemap[st2.name] = st2;
      
      this._push(st2);
    }
    
    for (let st2 of this) {
      st2.link(this);
    }
    
    return this;
  }
  
  get(id_or_name) {
    if (id_or_name in this.idmap)
      return this.idmap[id_or_name]
    else
      return this.namemap[id_or_name];
  }
  
  create(name="untitled") {
    let st = new Struct();
    st.name = name;
    this.add(st);
    
    return st;
  }
  
  rename(st, newname, oldname) {
    oldname = oldname === undefined ? st.name : oldname;
    
    if (st === undefined) {
      throw new Error("bad call to StructManager.rename");
    }
    
    console.log("renaming", st, newname);
    
    delete this.namemap[oldname];
    
    st.name = newname;
    this.namemap[st.name] = st;
    
    return this;
  }
  
  toJSON() {
    let ret = [];
    
    for (let stt of this) {
      ret.push(stt)
    }
    
    return {
      idgen : this.idgen,
      structs : ret
    }
  }
}



export const TagTypes = {
  TYPE : 1,
  FUNCTION : 2,
  NOTAG : 4
};

export const TagFlags = {
  SELECT : 1,
  UPDATE : 2
};

let TYPE = TagTypes.TYPE, FUNCTION = TagTypes.FUNCTION,
    NOTAG = TagTypes.NOTAG;
    
export const TagMaps = [TYPE, FUNCTION];

export class MemTag {
  constructor(start, end, name, type) {
    this.start = start;
    this.end = end;
    this.name = name;
    this.flag = 0;
    this.id = -1;
    this.type = type;
  }
  
  toJSON() {
    return {
      start : this.start,
      end : this.end,
      flag : this.flag,
      name : this.name,
      id : this.id
    }
  }
  
  loadJSON(obj) {
    this.start = obj.start;
    this.end = obj.end;
    this.flag = obj.flag;
    this.name = obj.name;
    this.id = obj.id;
    
    return this;
  }
};

export const MEMSIZE = 8*1024*1024
export let notag = new MemTag(0, MEMSIZE, "NOTAG", NOTAG);
notag.id = 0;

export class MemTagMap {
  constructor(tags) {
    this.idgen = 1;
    this.tags = tags;
    this.namemap = {};
    this.idmap = {};
    this.map = new Uint16Array(MEMSIZE);
    this.map.fill(0, 0, this.map.length);
    this.flag = 0;
    
    this._addNOTAG();
  }
  
  
  on_tick() {
    if (this.flag & TagFlags.UPDATE) {
      this.regenMap();
    }
  }
  
  get(addr) {
    let id = this.map[addr];
    return this.idmap[id];  
  }
  
  flagUpdate() {
    this.flag |= TagFlags.UPDATE;
  }
  
  regenMap() {
    console.log("regenerating memory map");
    
    this.flag &= ~TagFlags.UPDATE;
    
    let map = this.map;
    this.map.fill(0, 0, this.map.length);
    
    for (let tag of this.tags) {
      let start = tag.start, end = tag.end;
      let id = tag.id;
      
      for (let i=start; i<end; i++) {
        map[i] = id;
      }
    }
    
    return this;
  }
  
  toJSON() {
    return {
      flag : this.flag
    }
  }
  
  _addNOTAG() {
    if (this.idmap[0] !== undefined) {
      return;
    }
    
    this.idmap[0] = notag;
    this.namemap[notag.name] = notag;
    this.tags.push(notag);
    
    return this;
  }
  
  loadJSON(obj) {
    this.flag = obj.flag | TagFlags.UPDATE;
    
    this.regenMap();
  }
}

export class TagManager extends Array {
  constructor() {
    super();
    
    this.idgen = 0;
    this.idmap = {};
    this.maps = {};
    
    for (let type of TagMaps) {
      this.maps[type] = new MemTagMap(this);
    }
  }
  
  toJSON() {
    let tags = [];
    for (let tag of this) {
      tags.push(tag);
    }
    
    return {
      idgen : this.idgen,
      tags : tags,
      maps : this.maps,
    };
  }
  
  on_tick() {
    for (let k in this.maps) {
      this.maps[k].on_tick();
    }
  }

  createTag(name, type, addr, len) {
    let tag = new MemTag(start, end, name, type);
    tag.id = this.idgen++;
    
    this.tagmap[tag.id] = tag;
    this.push(tag);
    
    return tag;
  }
  
  add(tag) {
    tag.id = this.idgen++;
    
    this.idmap[tag.id] = tag;
    this.push(tag);
    
    return this;
  }
  
  loadJSON(obj) {
    this.idgen = obj.idgen;
    
    for (let otag of obj.tags) {
      let tag = new MemTag();
      tag.loadJSON(otag);
      
      this.push(tag);
      this.idmap[tag.id] = tag;
    }
    
    for (let k in obj.maps) {
      this.maps[k] = new MemTagMap(this);
      this.maps[k].loadJSON(obj.maps[k]);
    }
    
    return this;
  }
}

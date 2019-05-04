import * as disasm from './disasm.js';
import * as model from './model.js';
import * as structdef from './structdef.js';
import * as globevt from './global_events.js';

let EventTypes = globevt.EventTypes, EVT = EventTypes;

function gfire(type) {
  return () => {
    globevt.fire(type);
  }
}

function type_type_callback(val) {
  let test = structdef.StructTypes.ARRAY;// | structdef.StructTypes.STRUCT;
  test = test | structdef.StructTypes.POINTER;
  
  console.log("enum set in struct member type", val);
  let type = this.dataref;
  
  if (val == structdef.StructTypes.FIELD && typeof type.data != "number") {
    type.data = 1;
  }
  
  if (val & test) {
    if (type.data === undefined) {
      console.log("spawning subtype");
      type.data = new structdef.Type(structdef.StructTypes.INT32, undefined, "");
      type.data.parent = type;
    }
  }
  
  gfire(EVT.STRUCT_UPDATE);
}

export function define_type_type(api, cls) {
  let st = api.mapStruct(cls);
  
  st.enum("type", "type", structdef.StructTypes).on("change", type_type_callback);
  
  st.string("name", "name").on("change", function(val) {
    console.log("struct member or type's name change callback!", this.dataref);
  }).on("change", gfire(EVT.STRUCT_UPDATE));
  
   //array size, if an array
  st.int("size", "size").on("change", gfire(EVT.STRUCT_UPDATE));
  st.int("startbit", "startbit").read_only().radix(16);
  st.int("endbit", "endbit").read_only().radix(16);
  st.int("startbyte", "startbyte").read_only().radix(16);
  
  st.float("startbytef", "startbytef").read_only().decimalPlaces(1).customGetSet(function() {
    return this.dataref.startbit/8;
  });
  
  st.string("comment", "comment").on("change", gfire(EVT.STRUCT_UPDATE));
  
  return st;
}

export function define_struct_member(api) { //is actually a subclass of define_struct_type (struct.Type)
  define_type_type(api, structdef.Type);
  
  let st = define_type_type(api, structdef.StructMember);
  
  st.flags("flag", "flag", structdef.StructFlags).on("change", gfire(EVT.STRUCT_UPDATE));
  st.int("id", "id").on("change", gfire(EVT.STRUCT_UPDATE));
  
  return st;
  
}

export function define_struct_type(api) {
  let st = api.mapStruct(structdef.Struct);
  
  st.string("name", "name").on("change", function(val, old) {
    _appstate.model.structs.rename(this.dataref, val, old);
  }).on("change", gfire(EVT.STRUCT_UPDATE));
  
  st.array("members", "members", define_struct_member(api));
  
  st.int("id", "id").on("change", gfire(EVT.STRUCT_UPDATE));
  st.flags("flag", "flag", structdef.StructFlags).on("change", gfire(EVT.STRUCT_UPDATE));
  
  return st;
}

export function define_model_type(api) {
  let st = api.mapStruct(model.ROMCodeModel);
  
  st.array("structs", "structs", define_struct_type(api));
  
  return st;
}

import * as structedit from "./structedit.js";

export function define_structedit(api) {
  let st = api.mapStruct(structedit.exports.StructEditor);
  
  st.int("structid", "structid");
}

export function define_editors(api) {
  define_structedit(api);
}


export function api_define(api) {
  let st = api.mapStruct(disasm.exports.DisasmEditor);
  
  let dpath = st.int("addr", "addr", "Address", "Current memory address to display");
  dpath.range(0x80000000, Math.pow(2, 32)-1).radix(16); 
  
  define_model_type(api);
  define_struct_type(api);
  define_editors(api);
}

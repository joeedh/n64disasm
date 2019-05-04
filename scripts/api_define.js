import * as disasm from './disasm.js';
import * as model from './model.js';
import * as structdef from './structdef.js';
import * as globevt from './global_events.js';

let EventTypes = globevt.EventTypes, EVT = EventTypes;

function type_type_callback(val) {
  let test = structdef.StructTypes.ARRAY;// | structdef.StructTypes.STRUCT;
  test = test | structdef.StructTypes.POINTER;
  
  console.log("enum set in struct member type", val);
  let type = this.dataref;
  
  if (val & test) {
    if (type.data === undefined) {
      console.log("spawning subtype");
      type.data = new structdef.Type(structdef.StructTypes.INT32, undefined, "");
      type.data.parent = type;
    }
  }
}

export function define_type_type(api) {
  let st = api.mapStruct(structdef.Type);
  
  st.string("name", "name");
  st.enum("type", "type", structdef.StructTypes).on("change", type_type_callback);
  st.int("size", "size"); //array size, if an array
  st.string("comment", "comment");
  
  return st;
}

function gfire(type) {
  return () => {
    globevt.fire(type);
  }
}

export function define_struct_member(api) { //is actually a subclass of define_struct_type (struct.Type)
  let st = api.mapStruct(structdef.StructMember);
  
  st.enum("type", "type", structdef.StructTypes).on("change", type_type_callback);
  
  st.string("name", "name").on("change", function(val) {
    console.log("struct member name change callback!", this.dataref);
  }).on("change", gfire(EVT.STRUCT_UPDATE));
  
   //array size, if an array
  st.int("size", "size").on("change", gfire(EVT.STRUCT_UPDATE));
  st.flags("flag", "flag", structdef.StructFlags).on("change", gfire(EVT.STRUCT_UPDATE));
  st.int("id", "id").on("change", gfire(EVT.STRUCT_UPDATE));
  st.int("startbit", "startbit").on("change", gfire(EVT.STRUCT_UPDATE));
  st.string("comment", "comment").on("change", gfire(EVT.STRUCT_UPDATE));
  
  return st;
  
}

export function define_struct_type(api) {
  define_type_type(api);
  
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

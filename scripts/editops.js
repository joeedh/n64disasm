export let exports = {};
let ui, ui_base, toolsys, toolprop, controller;

import * as globevt from "./global_events.js";
let EVT = globevt.EventTypes;

export function init(mods) {
  ui = mods.ui, ui_base = mods.ui_base, toolsys = mods.simple_toolsys, toolprop = mods.toolprop, controller = mods.controller;
  
  let StringProperty = toolprop.StringProperty,
      EnumProperty = toolprop.EnumProperty,
      IntProperty = toolprop.IntProperty,
      FloatProperty = toolprop.FloatProperty,
      BoolProperty = toolprop.BoolProperty;
      
  let ToolOp = toolsys.ToolOp;
  let PropFlags = toolprop.PropFlags;
  let UndoFlags = toolsys.UndoFlags;
  let ToolFlags = toolsys.ToolFlags;
  
  exports.AddStructOp = class AddStruct extends ToolOp {
    constructor(name="unnamed") {
      super();
      
      this.inputs.name.setValue(name);
    }
    
    static tooldef() {return {
      uiname   : "Add Struct",
      is_modal : false,
      undoflag : 0,
      flag     : 0,
      inputs   : {
        name : new StringProperty(undefined, "name", "name", "name of new struct")
      },
      outputs : {
        structid : new IntProperty(undefined, "structid", "structid", "id of new struct")
      }
    }}
    
    exec(ctx) {
      let model = ctx.model;
      
      let st = model.structs.create(this.inputs.name.getValue());
      this.outputs.structid.setValue(st.id);
    }
  };
  
  exports.DelStructMember = class DelStructMember extends ToolOp {
    constructor(st, m) {
      super();
      
      this.inputs.structid.setValue(st.id);
      this.inputs.memberid.setValue(m.id);
    }
    
    static tooldef() {return {
      uiname   : "Del Struct Member",
      is_modal : false,
      undoflag : 0,
      flag     : 0,
      icon     : Icons.DELETE,
      inputs   : {
        structid : new IntProperty(undefined, "structid", "structid", "id of struct"),
        memberid : new IntProperty(undefined, "memberid", "memberid", "id of member"),
      },
      outputs : {
        structid : new IntProperty(undefined, "structid", "structid", "id of new struct")
      }
    }}
    
    exec(ctx) {
      let model = ctx.model;
      
      let st = model.structs.get(this.inputs.structid.getValue());
      if (st === undefined) {
        console.warn("error unknown struct", this.inputs.structid.getValue());
        return;
      }
      
      let m = st.idmap[this.inputs.memberid.getValue()];
      if (m === undefined) {
        console.warn("error unknown member", this.inputs.memberid.getValue());
        return;
      }
      
      st.remove(m);
      globevt.fire(EVT.STRUCT_UPDATE|EVT.DEL_STRUCT);
    }
  };
};












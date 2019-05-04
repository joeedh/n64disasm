import {mods} from './rjsmods.js';
import {OpNameMap, RegNames} from './opcode.js';
import {OpInfoTable, loadOpCode, OpI, OpR, OpJ} from './disasm_intern.js';
import * as rpc from './rpc.js';
let ui_base = mods.ui_base;
import {StructTypes, StructFlags, Type, Struct} from './structdef.js';
import * as editops from './editops.js';

import * as globevt from "./global_events.js";

window._globevt = globevt;

let EventTypes = globevt.EventTypes;
let EVT = EventTypes;

export var exports = {};

var hex = (f) => {
  return f.toString(16) + "h";
}

export let init = () => {
  let ScreenArea = mods.ScreenArea;
  ScreenArea.AreaTypes.STRUCT_EDITOR = 254;
  
  let ui = mods.ui, ui_base = mods.ui_base;
  let PackFlags = ui_base.PackFlags;
   
  exports.StructEditor = class StructEditor extends ScreenArea.Area {
    constructor() {
      super();
      
      this.ctx = _appstate.ctx;
      this.container = document.createElement("container-x");
      this.shadow.appendChild(this.container);
      this.searchstr = "";
      this.addr = 0;
      this.structid = undefined;
      
      this.structsenum = undefined;
      //this.header_row = this.container.row();
       
      let tb, rb, sb; //address textbox and rows textbox
      
      this.header = this.makeHeader(this.container);
      this.header_row = this.container.table().row();
      let table = this.table = this.container.table();
    }
    
    _unsubscribe() {
      console.trace();

      if (!this._subscribed) {
        return;
      }
      
      globevt.unsubscribe(this);
      this._subscribed = false;
    }
    
    _subscribe() {
      if (this._subscribed) {
        return;
      }
      
      this._subscribed = true;
      let types = EVT.UNDO_LOAD | 
                  EVT.STRUCT_UPDATE |
                  EVT.NEW_STRUCT |
                  EVT.DEL_STRUCT;
      
      globevt.subscribe(types, this.on_global_event.bind(this), this);
    }
    
    _init() {
      if (this.inactive) {
        //we're an inactive area? postpone init
        return;
      }

      super._init();
      
      this._subscribe();
      
      let func = () => { //wait for .ctx XXX this is so hacky
        if (this.ctx === undefined) {
          this.doOnce(func);
        } else {
          this.reload();
        }
      }
      
      this.doOnce(func);
    }
    
    on_global_event(event, data) {
      if (this.inactive) {
        //we're an inactive editor
        return;
      }
      
      console.log("got global event!", event, data, this._area_id);
      
      switch (event) {
        case EVT.UNDO_LOAD:
        case EVT.DEL_STRUCT:
        case EVT.ADD_STRUCT:
          this.doOnce(this.reload);
          break;
        case EVT.STRUCT_UPDATE:
          this.update();
          //this.doOnce(this.update);
          break;
      }
    }
    
    _ondestroy() {
      this._unsubscribe();
    }
    
    on_resize(size) {
      super.on_resize(size);
      
      //console.log("resize!", this.size);
      this.setCSS();
      //this.reload();
    }
    
    on_area_inactive() {
      this._ondestroy();
      super.on_area_inactive();
    }
    
    on_area_active() {
      this._subscribe();
      
      super.on_area_active();
      this.doOnce(this.reload);
    }
    
    setCSS() {
      //super.setCSS();
      
      let table = this.table;
      //table.style["overflow"] = "scroll";
      this.style["overflow"] = "scroll";
      
      table["position"] = "absolute";
      this.style["position"] = "absolute";
      
      //XXX this shouldn't be necassary,
      //setCSS should never be called on inactive areas
      //(which are the ones whose .size/.pos are set to undefined)
      if (this.size === undefined) {
        return;
      }
      
      table.style["width"] = this.size[0] + "px";
      table.style["height"] = this.size[1] + "px";
    }
    
    makeHeader2() {
      let row = this.header_row;
      
      row.clear();
      
      let model = this.ctx.model;
      let enumdef = {};
      for (let st of model.structs) {
        enumdef[st.name] = st.id;
      }
      
      this.structsenum = enumdef;
      
      row.listenum(undefined, "Struct", enumdef, undefined, (id) => {
        this.structid = id;
        this.reload();
      });
      row.button("new", () => {
        let ctx = this.ctx;
        
        let tool = new editops.exports.AddStructOp();
        ctx.execTool(tool);
        this.structid = tool.outputs.structid.getValue();
        
        let st = ctx.model.structs.create();
        this.structid = st.id;
        this.reload();
      });
      
    }
    
    reload() {
      let table = this.table, row;
      let model = this.ctx.model;
      table.clear();
      
      this.makeHeader2();
      let enumdef = this.structsenum;
      let prop = new ui_base.EnumProperty(undefined, enumdef);
      
      //console.log("structid:", this.structid);
      
      if (this.structid === undefined) {
        return;
      }

      let st = model.structs.get(this.structid);
      if (st === undefined) {
        return;
      }
      
      st.calcSize();
      
      row = table.row();
      let col = row.col();
      
      let path = "model.structs.idmap[" + this.structid + "]";
      col.label("Struct Name");
      col.textbox(path+".name").ctx = this.ctx;
      col.button("Add", () => {
        let st = model.structs.get(this.structid);
        
        if (st === undefined) {
          console.warn("failed to get struct in add member callback");
          return;
        }
        
        st.int32("untitled");
        this.reload();
      });
      
      //console.log(path);
      
      row = table.row();
     
      row.label("Offset (byte:[start:end bits])");
      row.label("Name");
      row.label("Type");
      row.label("Comment");
      row.label("Delete");
      
      let makeTool = (st, m) => {
        return () => {
          return new editops.exports.DelStructMember(st, m);
        }
      }
      
      let mi  =0;
      for (let m of st.members) {
        let path2 = path + ".members[" + mi + "]";
        
        row = table.row();
        row.background = "rgba(240, 240, 240, 1.0)";
        
        let row2 = row.row();
        row2.background = row.background;
        row2.pathlabel(path2 + ".startbytef");
        row2.pathlabel(path2 + ".startbit", ": [");
        row2.pathlabel(path2 + ".endbit", ":");
        row2.label("]");
        
        row.textbox(path2 + ".name");
        let col = row.col();
        this.makeTypeUI(col, m, path2, st);
        row.textbox(path2 + ".comment");
        
        row.tool(editops.exports.DelStructMember, makeTool(st, m), PackFlags.USE_ICONS);
        
        mi++;
      }
    }
    
    makeTypeUI(col, type, path2, struct) {
      col.ctx = this.ctx;
      let t = col.listenum(path2 + ".type", undefined, undefined, type.type);
      
      t.onselect = () => {
        let st = StructTypes;
        //if (type.type & (st.ARRAY|st.STRUCT|st.POINTER)) {
          
          this.doOnce(this.reload);
        //}
      }
      
      //console.log(path2  + ".type");
      
      if (type.type == StructTypes.FIELD) {
        col.textbox(path2 + ".size");
      } else if (type.type === StructTypes.ARRAY) {
        if (type.data === undefined) {
          return;
        //  type.data = new Type(StructTypes.INT32, 
        }
        
        col.textbox(path2 + ".size");
        
        
        this.makeTypeUI(col, type.data, path2 + ".data", struct);
      } else if (type.type == StructTypes.STRUCT) {
          let name = type.data !== undefined ? type.data.name : "undefined";
          
          col = col.row();
          col.label("Struct")
          let lenum = col.listenum(undefined, name, this.structsenum, undefined, (id) => {
            if (this.ctx === undefined) {
              return;
            }
            
            let st = this.ctx.model.structs.idmap[id];
            if (st === undefined) {
              console.warn("error in structedit.js", id);
              return;
            }
            
            let have_pointer = false;
            let p = type;
            
            while (p !== undefined && !(p instanceof Struct)) {
              if (p.type == StructTypes.POINTER) {
                have_pointer = true;
                break;
              }
              p = p.parent;
            }
            
            if (st === struct && !have_pointer) {
              let oldname = typeof (type.data) == "object" ? type.data.name : undefined;
              oldname = "" + oldname;
              
              lenum.setAttribute("name", oldname);
              lenum.updateName();
              
              console.warn("can't embedd one struct in itself");
              alert("can't embedd one struct in itself");
              
              return;
            }
            
            lenum.setAttribute("name", st.name);
            lenum.updateName();
            type.data = st;
          });
  
        //this.makeTypeUI(col, type.data, path2 + ".data", struct);
      } else if (type.type == StructTypes.POINTER) {
        this.makeTypeUI(col, type.data, path2 + ".data", struct);
      } else {
        return;
      }
    }
    
    copy() {
      let ret = document.createElement("structeditor-area-x");
      ret.ctx = this.ctx;
      ret.structid = this.structid;
      
      return ret;
    }
    
    toJSON() {
      let ret = {
        active_struct : this.structid
      };
      
      return Object.assign(super.toJSON(), ret);
    }
    
    loadJSON(obj) {
      super.loadJSON(obj);
      
      if (obj.active_struct !== undefined) {
        this.structid = obj.active_struct;
        
        let timer = window.setInterval(() => {
          if (this.ctx !== undefined) {
            this.table.ctx = this.ctx;
            this.table.dom.ctx = this.ctx;
            this.update();
            window.clearInterval(timer);
            this.reload();
          }
        }, 10);
      }
    }
    
    static define() { return {
      tagname  : "structeditor-area-x",
      areaname : "structeditor_area",
      uiname   : "Struct Editor"
    };}
  }
  
  ScreenArea.Area.register(exports.StructEditor);
};

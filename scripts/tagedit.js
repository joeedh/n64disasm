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
   
  exports.TagEditor = class TagEditor extends ScreenArea.Area {
    constructor() {
      super();
      
      this.ctx = _appstate.ctx;
      this.container = document.createElement("container-x");
      this.shadow.appendChild(this.container);
      this.searchstr = "";
      this.addr = 0;
      this.tagid = undefined;
      
      this.tagsenum = undefined;
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
      for (let tag of model.tags) {
        enumdef[tag.name] = tag.id;
      }
      
      this.tagsenum = enumdef;
      
      row.listenum(undefined, "Struct", enumdef, undefined, (id) => {
        this.tagid = id;
        this.reload();
      });
      row.button("new", () => {
        let ctx = this.ctx;
        
        let tool = new editops.exports.AddStructOp();
        ctx.execTool(tool);
        this.tagid = tool.outputs.tagid.getValue();
        
        let st = ctx.model.structs.create();
        this.tagid = st.id;
        this.reload();
      });
      
    }
    
    reload() {
      let table = this.table, row;
      let model = this.ctx.model;
      table.clear();
      
      this.makeHeader2();
      let enumdef = this.tagsenum;
      let prop = new ui_base.EnumProperty(undefined, enumdef);
      
      //console.log("tagid:", this.tagid);
      
      if (this.tagid === undefined) {
        return;
      }

      let st = model.structs.get(this.tagid);
      if (st === undefined) {
        return;
      }
      
      st.calcSize();
      
      row = table.row();
      let col = row.col();
      
      let path = "model.structs.idmap[" + this.tagid + "]";
    }
    
    makeTypeUI(col, type, path2, struct) {
    }
    
    copy() {
      let ret = document.createElement("tageditor-area-x");
      ret.ctx = this.ctx;
      ret.tagid = this.tagid;
      
      return ret;
    }
    
    toJSON() {
      let ret = {
        active_tag : this.tagid
      };
      
      return Object.assign(super.toJSON(), ret);
    }
    
    loadJSON(obj) {
      super.loadJSON(obj);
      
      if (obj.active_tag !== undefined) {
        this.tagid = obj.active_tag;
        
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
      tagname  : "tageditor-area-x",
      areaname : "tageditor_area",
      uiname   : "Tag Editor"
    };}
  }
  
  ScreenArea.Area.register(exports.TagEditor);
};

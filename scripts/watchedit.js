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

let asciimap = new Array(256);
for (let i=0; i<256; i++) {
  for (let i=0; i<256; i++) {
    if (i > 32 && i < 128) {
      asciimap[i] = String.fromCharCode(i);
    } else {
      asciimap[i] = "?";
    }
  }  
  
  asciimap["\n".charCodeAt(0)] = "\\n"
  asciimap["\r".charCodeAt(0)] = "\\r"
  asciimap["\t".charCodeAt(0)] = "\\t"
  asciimap["\v".charCodeAt(0)] = "\\v"  
}
window.asciimap = asciimap;

export let init = () => {
  let ScreenArea = mods.ScreenArea;
  ScreenArea.AreaTypes.STRUCT_EDITOR = 254;
  
  let ui = mods.ui, ui_base = mods.ui_base;
  let PackFlags = ui_base.PackFlags;
   
  
   
  exports.WatchPrinter = class WatchPrinter extends ui_base.UIBase {
    constructor() {
      super();
      
      let style = document.createElement("style")
      style.innerText = `
      `;
      
      this.shadow.appendChild(style);
      
      this.dom = document.createElement("container-x");
      this.shadow.appendChild(this.dom);
    }
    
    static define() {return {
      tagname : "watchprinter-x"
    }}
  }
  
  exports.MemEditor = class MemEditor extends ScreenArea.Area {
    constructor() {
      super();
      
      this._fetchid = 0;
      
      this.ctx = _appstate.ctx;
      this.container = document.createElement("container-x");
      this.shadow.appendChild(this.container);
      this.searchstr = "";
      
      this.addr = 0x7fffff;
      this.rows = 50;
      this.cols = 20;
      
      this.structid = undefined;
      
      this.structsenum = undefined;
       
      let tb, rb, sb; //address textbox and rows textbox
      
      this.header = this.makeHeader(this.container);
      this.header_table = this.container.table();
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
          this.fetch();
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
          this.doOnce(this.fetch);
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
      //this.fetch();
    }
    
    on_area_inactive() {
      this._ondestroy();
      super.on_area_inactive();
    }
    
    on_area_active() {
      this._subscribe();
      
      super.on_area_active();
      this.doOnce(this.fetch);
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
      this.header_table.clear();
      let row = this.header_table.row().row();
      
      let path = this.buildDataPath();
      
      console.log(path);
      row.label("Address");
      row.textbox(path + ".addr"); 
      row.label("Rows");
      row.textbox(path + ".rows"); 
       
      let row2 = this.header_table.row();
      row2.button("Fetch", () => {
        console.log("fetch button");
        this.fetch();
      });
    }
    
    fetch() {
      this.doOnce(this._fetch);
    }
    
    _fetch() {
      let fetchid = ++this._fetchid;
      
      let table = this.table, row;
      let model = this.ctx.model;
      let addr = this.addr;
      let cols = this.cols, rows = this.rows;
      let size = cols*rows;
      let x = 0, y = 0;
      
      //size = 20;
      table.clear();
      this.makeHeader2();
      
      let colors = [
        "rgba(250, 250, 250, 1.0)",
        "rgba(225, 225, 225, 1.0)"
      ];
      let ci = 0;
      
      console.log("size", size);
      model.fetchMemory(addr, size).then((block) => {
        let row;// = table.row();
        //row.background = colors[ci];
        
        if (this._fetchid != fetchid) {
          console.log("aborting old memedit fetch", this._fetchid, fetchid);
          return;
        }
        
        console.log("got data", block);
        let s = "", s2 = "";
        
        for (let i=0; i<block.length; i++) {
          let x2 = i % cols, y2 = ~~(i / cols);
          if (y2 != y) {
            let addr2 = (addr + i).toString(16) + "h";
            while (addr2.length < 8) {
              addr2 = "0" + addr2;
            }
            
            ci = ci ^ 1;
            row = table.row();
            row.background = colors[ci];
            
            row._tr.style["margin"] = "0px";
            row._tr.style["padding"] = "0px";
            
            //mem address
            let l = row.label(addr2);
            l.style["padding"] = l.style["margin"] = "0px";
            
            //hex
            l = row.label(s);
            l.style["padding"] = l.style["margin"] = "0px";
            
            //ascii
            l = row.label(s2);
            l.style["padding"] = l.style["margin"] = "0px";
            
            s = "";
            s2 = "";
          }
          
          let str = block[i].toString(16).toUpperCase();
          while (str.length < 2) {
            str = "0" + str;
          }
          
          s += " " + str;
          s2 += asciimap[block[i]];
          
          //let l = row.label(str);
          //l.style["padding"] = l.style["margin"] = "0px";
          
          x = x2, y = y2;
        }
      });
    }
    
    copy() {
      let ret = document.createElement("watchedit-area-x");
      ret.ctx = this.ctx;
      ret.structid = this.structid;
      
      return ret;
    }
    
    toJSON() {
      let ret = {
        addr : this.addr,
        rows : this.rows
      };
      
      return Object.assign(super.toJSON(), ret);
    }
    
    loadJSON(obj) {
      super.loadJSON(obj);
      
      this.addr = obj.addr;
      this.rows = obj.rows === undefined ? this.rows : obj.rows;
      this.doOnce(this.fetch);
    }
    
    static define() { return {
      tagname  : "watchedit-area-x",
      areaname : "watchedit_area",
      uiname   : "Watch"
    };}
  }
  
  ScreenArea.Area.register(exports.WatchEditor);
};

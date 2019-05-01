import {mods} from './rjsmods.js';
import {OpNameMap, RegNames} from './opcode.js';
import {OpInfoTable, loadOpCode, OpI, OpR, OpJ} from './disasm_intern.js';
import * as rpc from './rpc.js';
let ui_base = mods.ui_base;

export var exports = {};

var hex = (f) => {
  return f.toString(16) + "h";
}

export let init = () => {
  let ScreenArea = mods.ScreenArea;
  ScreenArea.AreaTypes.STRUCT_EDITOR = 254;
  
  let ui = mods.ui, ui_base = mods.ui_base;
   
  exports.StructEditor = class StructEditor extends ScreenArea.Area {
    constructor() {
      super();
      
      this.ctx = _appstate.ctx;
      this.container = document.createElement("container-x");
      this.shadow.appendChild(this.container);
      this.searchstr = "";
      this.addr = 0;
      
      let tb, rb, sb; //address textbox and rows textbox
      
      let header = this.makeHeader(this.container);
    }
    
    copy() {
      let ret = document.createElement("structeditor-area-x");
      ret.ctx = this.ctx;
      return ret;
    }
    
    static define() { return {
      tagname  : "structeditor-area-x",
      areaname : "structeditor_area",
      uiname   : "Struct Editor"
    };}
  }
  
  ScreenArea.Area.register(exports.StructEditor);
};

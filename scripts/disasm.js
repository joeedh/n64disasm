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
  ScreenArea.AreaTypes.DISASM_EDITOR = 255;
  
  let ui = mods.ui, ui_base = mods.ui_base;
   
  exports.DisasmWidget = class DisasmWidget extends ui.Container {
    constructor() {
      super();
      
      this.ctx = _appstate.ctx;
      
      this.active = undefined;
      this.rows = [];
      this.sortrows = [];
      
      let style = this.styleTag = document.createElement("style");
      style.textContent = `
      
      .table_tr1:hover {
        background-color: rgb(225, 225, 225);
      }
      
      .table_tr2:hover {
        background-color: rgb(225, 225, 225);
      }
      
      .table_tr1 {
        background-color: rgb(235, 235, 235);
      }
      
      .table_tr2 {
        background-color: rgb(250, 250, 250);
      }
      
      .table_sel {
        background-color: ${ui_base.getDefault("BoxHighlight")};
      }
      `;
      
      //this.shadow.appendChild(style);

      //let table = this.table = document.createElement("table");
      //this.shadow.appendChild(table);
      
      let downmap = {};
      this.addEventListener("keyup", (e) => {
        delete downmap[e.keyCode];
      });
      
      this.addEventListener("keydown", (e) => {
        //console.log(e.keyCode);
        
        let ok = !(e.keyCode in downmap);
        
        downmap[e.keyCode] = 1;
        switch (e.keyCode) {
          case 38: //up
            this.incActive(-1);
            break;
          case 40: //down
            this.incActive(1);
            break;
          default:
            return; //don't prevent default or stop propagation, didn't handle event
        }
        
        e.preventDefault();
        e.stopPropagation();
      });
      
      this.crows = this.table();
      this.crows.dom.appendChild(this.styleTag);
      this.crows.background = "white";
      console.log("TABLE", this.crows);
      
      for (let i=0; i<10; i++) {
        this.addItem(0x23423, BEQ);
      }
      
    }
    
    clear() {
      this.rows.length = 0;
      this.sortrows.length = 0;
      this.crows.clear();
    }
    
    _initTR(tr) {
    }
    
    setHighlight(tr) {
      let old = this.rows.highlight;
      this.rows.highlight = tr;
      
      if (old !== undefined) {
        old.background = this._getColor(old);
      }
      
      if (tr !== undefined) {
        //console.log(tr)
        tr.background = "rgba(185, 200, 255, 0.1)";
        tr.focus();
      }
      
      //this.updateColors();
    }
    
    setActive(tr) {
      let old = this.rows.active;
      
      this.rows.active = tr;
      if (tr !== undefined) {
        //console.log(tr)
        tr.background = this._getColor(tr);
        tr.focus();
      }
      
      if (old !== undefined) {
        old.background = this._getColor(old);
      }
      
      //this.updateColors();
    }
    
    incActive(dir) {
      if (this.rows.active === undefined) {
        return;
      }
      
      let i = this.sortrows.indexOf(this.rows.active);
      i += dir;
      
      i = Math.min(Math.max(i, 0), this.sortrows.length-1);
      this.setActive(this.sortrows[i]);
    }
    
    _getColor(row) {
      if (row === this.rows.active) {
        return "rgb(155, 215, 255)";
      }
      if (row.shade) {
        return "rgb(245, 245, 245)";
      } else {
        return "rgb(225, 225, 225)";
      }
    }
          
    updateColors() {
      for (let row of this.rows) {
        row.background = this._getColor(row);
      }
    }

    addItem(addr, op, name, extra="sdf") {
      let i = this.sortrows.length & 1;

      let row = this.crows.row();
      row.tabIndex = 0;
      
      this.rows.push(row);
      this.sortrows.push(row);
      row.shade = i;
      
      let bg = this._getColor(row);
      
      //console.log("ROW", row);
      row.background = bg;
      let this2 = this;
      
      function callback(e) {
        //this2.updateColors();
        this2.setHighlight(row);
        //row.background = "rgb(185, 200, 255)";
      }
      
      row.addEventListener("mouseover", callback);
      row.addEventListener("click", function(e) {
        console.log("row click!");

        this2.setActive(row);
      });
      
      let textaddr = this.ctx.model.mapSymbol(addr, true);
      
      let label = row.label(textaddr);
      label.addr = addr;
      
      label.addEventListener("click", function(e) {
        console.log("addr click!", this.parentWidget);
        let textbox = this.parentWidget.textbox(this.text);
        
        textbox.onkeydown = (e) => {
          switch (e.keyCode) {
            case 27: //escape
              textbox.remove();
              this.hidden = false;
              break;
            case 9: //tab
            case 13: //enter
              let symbol = textbox.text.trim();
              
              if (symbol.length > 0) {
                this.ctx.model.addSymbol(symbol, parseInt(this.addr));
                this.text = symbol;
              } else {
                this.ctx.model.removeSymbol(parseInt(this.addr));
                this.text = hex(parseInt(this.addr));
              }
              
              textbox.remove();
              this.hidden = false;
              
              break;
          }
          console.log(e.keyCode);
        };
        this.hidden = true;
      });
      
      let sop = op.toString(16) + "h";
      while (sop.length < 3) {
        sop = "0" + sop
      }
      
      row.label("["+sop+"] "+name)
      row.label(extra);
      
      if (name in OpInfoTable) {
        row.label(OpInfoTable[name]);
      }
    }
    
    static define() {return {
      tagname : "disasm-widget-x"
    }}
  }
  
  ui_base.UIBase.register(exports.DisasmWidget);
  
  exports.DisasmEditor = class DisasmEditor extends mods.ScreenArea.Area {
    constructor() {
      super();
      
      this.ctx = _appstate.ctx;
      this.container = document.createElement("container-x");
      this.shadow.appendChild(this.container);
      this.searchstr = "";
      this.addr = 0;
      
      let tb, rb, sb; //address textbox and rows textbox
      
      let header = this.makeHeader(this.container);
      
      let row = this.container.row();
      row.button("Load Mem", () => {
        let addr = parseInt(tb.text);
        console.log("addr", addr);
        this.fetchPage(addr, parseInt(rb.text));
      }, this, 1);
            
      //tb = this.container.textbox("2147713036");
      //tb = this.container.textbox("2214609044");
      
      row = this.container.row();
      
      tb = row.textbox("2149149920");
      row.label("Rows:");
      rb = this.rowtext = row.textbox("100");
      row.label("Search:");
      sb = row.textbox("", (t) => {
        this.searchstr = t;
        this.applySearch();
      });
        
      
      this.syms_enum = row.listenum(undefined, "Function", {A_B_2 : 1, b: 2, c: 3}, 1);
      this.buildSymsEnum();
      this.syms_enum.onselect = (id) => {
        id = parseInt(id);
        this.fetchPage(id, parseInt(this.rowtext.text));
      }
      this.widget = document.createElement("disasm-widget-x");
      this.widget.tabIndex = 0; //make focusable/visiable to keyboard events
      this.shadow.appendChild(this.widget);
    }
    
    static define() { return {
      tagname  : "disasm-area-x",
      areaname : "disasm_area",
      uiname   : "Disassembler"
    };}
    
    buildSymsEnum() {
      let def = {};
      let model = this.ctx.model;
      let uinames = {};
      
      let id = 0;
      
      for (let key in model.symbols) {
        let sym = model.symbols[key];
        
        let key2 = sym.name + (id++);
        def[key2] = sym.address;
        uinames[key2] = sym.name;
      }
      
      let prop = new ui_base.EnumProperty(undefined, def, "symbols", "Function", "function symbols", 0);
      prop.ui_value_names = uinames;
      this.syms_enum.prop = prop;
    }
    
    applySearch() {
      return;
      
      let t = this.searchstr;
      t = t.toLowerCase().trim();
      
      let table = this.widget.table;
      
      for (let child of table.childNodes) {
        let str = child.innerHTML.toLowerCase();
        
        let hide = str.search(t) < 0 && t.length > 0;
        child.hidden = hide;
      }
    }
    
    fetchPage(addr, lines=100) {
      addr -= 4;
      
      let model = this.ctx.model;
      
      function hex(f) {
        return f.toString(16).toUpperCase() + "h";
      }
      
      this.widget.clear();
      
      rpc.exec("myReadBlock", [addr, lines*4]).then((value) => {
        //console.log("mem", value);
        
        for (let i=0; i<value.length; i++) {
          let code = value[i];
          //code = flip_endian(code);
          
          let dis = loadOpCode(addr+i*4, code);
          let extra = "";
          
          //extra = ""+code.toString(16)+"h"
          if (dis.data !== undefined) {
            if (dis.data instanceof OpJ) {
              extra = model.mapSymbol(dis.data.realtarget);
            } else if (dis.data instanceof OpR) {
              let d = dis.data;
              extra = "funct=" + hex(d.funct)
              extra += " sa=" + RegNames[d.sa].toUpperCase();
              extra += " rd=" + RegNames[d.sa].toUpperCase();
              extra += " rt=" + RegNames[d.sa].toUpperCase();
              extra += " rs=" + RegNames[d.sa].toUpperCase();
              
            } else if (dis.data instanceof OpI) {
              extra = "#" + hex(dis.data.immediate);
              extra += " rt="+RegNames[dis.data.rt].toUpperCase();
              extra += " rs="+RegNames[dis.data.rs].toUpperCase();
            }
          }
          //console.log(dis);
          this.widget.addItem(addr+i*4, dis.op, dis.name, extra);
        }
        
        this.applySearch();
      });
      /*
      function next() {
        rpc.exec("readU32", [addr+i]).then((value) => {
          console.log("v", value);
          if (i++ < lines) {
            next();
          }
        });
        
      }
      next();//*/
    }
    
    copy() {
      let ret = document.createElement("disasm-area-x");
      
      ret.ctx = this.ctx;
      
      return ret;
    }
    
    toJSON() {
      let ret = super.toJSON();
      ret.addr = this.addr;
      return ret;
    }
    
    loadJSON(obj) {
      super.loadJSON(obj);
      this.addr = obj.addr;
      
      return this;
    }
  }
  
  ScreenArea.Area.register(exports.DisasmEditor);
};

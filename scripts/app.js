"use strict";

import './polyfill.js';
import * as rpc from './rpc.js';
import {mods} from './rjsmods.js';
import * as disasm from './disasm.js';
import * as structedit from './structedit.js';
import {config} from './config.js';
import * as model from './model.js';
import * as globevt from './global_events.js';

let EVT = globevt.EventTypes;

window._rpc = rpc; //for debugging use only
window._model = model; //for debugging use only

let ui, FrameManager, ui_widgets, ui_base, controller;
let ui_noteframe;
import {api_define} from './api_define.js';

let LOCALSTORAGE_KEY = "startup_n64disasm";
let VERSION = "0.0.1";

let last_size = [0, 0];

export class AppState {
  constructor() {
    this.ctx = new mods.simple_toolsys.Context();
    
    this.model = new model.ROMCodeModel();
    this._last_remote_json = undefined;
    this._last_localstorage_json = undefined;
    
    this.toolstack = new mods.simple_toolsys.ToolStack();
    
    this.toolstack._undo = this.toolstack.undo;
    this.toolstack.undo = () => {
      this.toolstack._undo();
      globevt.fire(EVT.UNDO);
    };
    
    this.toolstack._redo = this.toolstack.redo;
    this.toolstack.redo = () => {
      this.toolstack._redo();
      globevt.fire(EVT.REDO);
    };
    
    this.api = new controller.DataAPI();
    this.api.prefix = "state.";
    
    this.screen = new FrameManager.Screen();
  }
  
  on_tick() {
    let w = window.innerWidth, h = window.innerHeight;
    
    w -= 7;
    h -= 7;
    
    if (last_size[0] != w || last_size[1] != h) {
      last_size[0] = w;
      last_size[1] = h;
      this.screen.on_resize(last_size);
    }
    this.screen.update();
  }
  
  makeScreen() {
    this.screen.clear();
    
    let ctx = this.ctx;
    
    this.screen = this.gui = document.createElement("screen-x");
    this.screen.ctx = ctx;
    this.screen.listen();
    
    this.screen.size = [window.innerWidth, window.innerHeight];
    
    let sarea = document.createElement("screenarea-x");
    
    sarea.size[0] = window.innerWidth;
    sarea.size[1] = window.innerHeight;
    
    this.screen.makeBorders();
    
    sarea.setCSS();
    this.screen.setCSS();
    
    document.body.appendChild(this.screen);
    this.screen.appendChild(sarea);
    
    sarea.switch_editor(disasm.exports.DisasmEditor);
  }
  
  toJSON() {
    return {
      version : VERSION,
      model : this.model,
      config : JSON.parse(JSON.stringify(config)),
      screen : this.screen
    }
  }
  
  loadJSON(obj, load_screen=true) {
    this.model.loadJSON(obj.model);
    
    if (load_screen) {
      try {
        this.screen.loadJSON(obj.screen, true);
      } catch (error) {
        print_stack(error);
        console.log("failed to load UI layout: error");
      }
    }
    
    config.loadJSON(obj.config);
  }
  
  saveRemote() {
    let data = JSON.stringify(this);
    if (data == this._last_remote_json) {
      return;
    }
    
    this._last_remote_json = data;
    console.log("saving remote data");
    
    let onerror = (err) => {
      console.log("ERROR", err);
      ui_noteframe.sendNote("Save error", "red");
      this._last_remote_json = undefined;
    }
    
    fetch("http://127.0.0.1:5001/save", {
      method : "POST",
      mode : "no-cors",
      cache : "no-cache",
      headers : {
        "Content-Type": "text/json"
      },
      body : data
    }).catch(() => {
      ui_noteframe.sendNote("Save error", "red");
      this._last_remote_json = undefined;
    }).then((resp, onerror) => {
      if (!resp.ok) {
        console.log("Error saving remote!", resp);
        ui_noteframe.sendNote("Save error", "red");
        this._last_remote_json = undefined;
      }
    });
  }
  
  genUndoFile() {
    return JSON.stringify(this);
  }
  
  loadUndoFile(file) {
    this.loadJSON(JSON.parse(file), false);
    globevt.fire(EVT.UNDO_LOAD);
  }
  
  on_keydown(e) {
    let active = this.screen.pickElement(this.screen.mpos[0], this.screen.mpos[1]);
    
    console.log(active !== undefined ? active.tagName.toLowerCase() : "nothing");
    
    //textboxes have their own undo handlers
    if (active === undefined || active.tagName.toLowerCase() != "textbox-x") {
      this.on_keydown_undo(e);
    } else if (e.keyCode == 82) {
      //still prevent page reload though
      e.preventDefault();
    }
  }
  
  on_keydown_undo(e) {
    //console.log(e.keyCode);
    
    let code = e.keyCode;
    //shift, control, alt modifiers
    let S = 512, C = 1024, A = 2048;
    
    let handled = true;
    if (e.ctrlKey) {
      code |= C;
    }
    if (e.shiftKey) {
      code |= S;
    }
    if (e.altKey) {
      code |= A;
    }
    
    switch (code) {
      case 82|C: //rkey
      case 89|C: //ykey
      case 90|S|C:
        this.toolstack.redo();
        break;
      case 90|C: //zkey
        this.toolstack.undo();
        break;
      default:
        handled = false;
    }
    
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
  
  save() {
    let data = JSON.stringify(this);
    
    if (data == this._last_localstorage_json) {
      return;
    }
    
    console.log("autosaving in localstorage. . .");
    
    localStorage[LOCALSTORAGE_KEY] = data;
    this._last_localstorage_json = data;
  }
  
  load() {
    let obj;
    
    if (!(LOCALSTORAGE_KEY in localStorage)) {
      //no data is not a failure, e.g. first time run
      return 1;
    }
    
    try {
      obj = JSON.parse(localStorage[LOCALSTORAGE_KEY]);
    } catch (error) {
      console.warn("failed to load localstorage data");
      return 0;
    }
    
    console.log("Loading. . .", obj);
    this.loadJSON(obj);
    
    return 1;
  }
}

export function start() {
  console.log("starting. . .");
  
  rpc.connect();
  
  ui = mods.ui;
  ui_noteframe = mods.ui_noteframe;
  controller = mods.controller;
  FrameManager = mods.FrameManager;
  ui_widgets = mods.ui_widgets;
  ui_base = mods.ui_base;
  
  window._appstate = new AppState();
  
  api_define(_appstate.api);
  
  window.addEventListener("keydown", (e) => {
    _appstate.on_keydown(e);
  });
  
  _appstate.makeScreen();
  if (!_appstate.load()) {
    //don't start event timers if load failed
    return;
  }
  
  //make on_tick event timer
  window.setInterval(() => {    
    _appstate.on_tick();
  }, 150);
  
  //make autosave timer
  window.setInterval(() => {
    //console.log("autosaving");
    _appstate.save();
  }, 1000);
  
  window.setInterval(() => {
    //console.log("autosaving remote");
    _appstate.saveRemote();
  }, 2000);
    
  console.log("done");
}
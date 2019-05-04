"use strict";

import './polyfill.js';
import * as rpc from './rpc.js';
import {mods} from './rjsmods.js';
import * as disasm from './disasm.js';
import * as structedit from './structedit.js';
import {config} from './config.js';
import * as model from './model.js';

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
  
  loadJSON(obj) {
    this.model.loadJSON(obj.model);
    
    try {
      this.screen.loadJSON(obj.screen, true);
    } catch (error) {
      print_stack(error);
      console.log("failed to load UI layout: error");
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
    
    try {
      obj = JSON.parse(localStorage[LOCALSTORAGE_KEY]);
    } catch (error) {
      console.warn("failed to load localstorage data");
      return;
    }
    
    console.log("Loading. . .", obj);
    this.loadJSON(obj);
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
  
  _appstate.makeScreen();
  _appstate.load();
  
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
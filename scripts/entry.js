import * as app from './app.js';
import {mods} from './rjsmods.js';
import * as disasm from './disasm.js';
import * as structedit from './structedit.js';
import * as editops from './editops.js';

window.init = () => {
  console.log("init!");
  
  require.config({
    baseDir : "path.ux/scripts",
    baseUrl : "path.ux/scripts"
  });
  
  require(["ui", "FrameManager", "ui_widgets", "simple_toolsys", "ui_base", "ScreenArea",
           "controller", "ui_noteframe", "toolprop"], 
          (ui, FrameManager, ui_widgets, simple_toolsys, ui_base, ScreenArea, controller,
           ui_noteframe, toolprop) => {
    
    mods.ui = ui;
    mods.ui_noteframe = ui_noteframe;
    mods.FrameManager = FrameManager;
    mods.ui_widgets = ui_widgets;
    mods.simple_toolsys = simple_toolsys;
    mods.ui_base = ui_base;
    mods.ScreenArea = ScreenArea;
    mods.controller = controller;
    mods.toolprop = toolprop;
    
    disasm.init();
    structedit.init();
    editops.init(mods);
    
    app.start();
  });
}

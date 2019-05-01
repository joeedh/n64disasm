import * as disasm from './disasm.js';

export function api_define(api) {
  let st = api.mapStruct(disasm.exports.DisasmEditor);
  
  st.int("addr", "addr", "Address", "Current memory address to display").range(0x80000000, Math.pow(2, 32)-1);  
}


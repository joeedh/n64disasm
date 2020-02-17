import * as rpc from './rpc.js';
import * as dis from './disasm_intern.js';
import {Struct, StructManager} from './structdef.js';
import {TagFlags, MemTag, MemTagMap, TagManager} from './memmap.js';

import * as typeparser from './typeparser.js';

import * as globevt from './global_events.js';
let EVT = globevt.EventTypes;

//8008b600h 

export var majora_mask_symtable = `TextXY,0x800872EC
0x80080CE0,dma_rom_to_ram
0x8008727C,TextRGBA
0x800879AC,TextString
0x80087974,TextDo
0x8008ab60,__osSetCause
0x8008b070,osSetIntMask
0x8008b110,osGetIntMask
0x80090030,__osGetConfig
0x80090040,__osSetConfig
0x80090a60,__osProbeTLB
0x80091e20,osGetCount
0x80092260,sqrtf
0x80093940,osUnmapTLBAll
0x800966c0,__osSetCompare
0x800966d0,__osGetCompare
0x8009b580,__osSetFpcCsr
0x8009b590,__osGetFpcCsr
0x8009df40,osWritebackDCacheAll
0x8008ab70,osSendMesg
0x8008ae70,osStopThread
0x8008af30,osRecvMesg
0x8008b430,__sinf/fsin/sinf
0x8008b5f0,sins
0x8008b970,__ull_rshift
0x8008b99c,__ull_rem
0x8008b9d8,__ull_div
0x8008ba14,__ll_lshift
0x8008ba40,__ll_rem
0x8008ba7c,__ll_div
0x8008bad8,__ll_mul
0x8008bb08,__ull_divremi
0x8008bb68,__ll_mod
0x8008bc04,__ll_rshift
0x8008ca00,__osDequeueThread
0x8008cc00,bzero/_bzero/blkclr/_blkclr
0x80090970,osStopTimer
0x80093e60,osCreateMesgQueue
0x80093e90,osInvalICache
0x80093f10,osInvalDCache
0x80094ef0,osJamMesg
0x80095040,osSetThreadPri
0x80095120,osGetThreadPri
0x80095740,bcmp/_bcmp
0x80095860,osGetTime
0x80095ac0,__osSetGlobalIntMask
0x800966e0,osDpGetStatus
0x800966f0,osDpSetStatus
0x80096700,bcopy/_bcopy
0x80096a10,__osResetGlobalIntMask
0x80097380,__cosf/fcos/cosf
0x800976a0,coss
0x800976d0,osSetTime
0x8009d860,_Litob
0x8009dbf0,__osSpGetStatus
0x8009dc00,__osSpSetStatus
0x8009e1b0,osStartThread
0x8009e460,__d_to_ll
0x8009e47c,__f_to_ll
0x8009e498,__d_to_ull
0x8009e538,__f_to_ull
0x8009e5d4,__ll_to_d
0x8009e5ec,__ll_to_f
0x8009e604,__ull_to_d
0x8009e638,__ull_to_f
0x800a0070,osViModeNtscHpf1
0x800a00c0,osViModeMpalHpf1
0x800a0a80,osViModeNtscHpn1
0x800a0ba0,osViModeNtscLan1
0x800a0bf0,osViModeMpalLan1
0x8008fe10,osReadHost
0x80093fc0,__rmonSendFault
0x80094034,__rmonIOflush
0x80094084,__rmonIOputw
0x800940f0,__rmonIOhandler
0x80097880,__osRdbSend
0x80098180,__rmonExecute
0x80098220,__rmonWriteWordTo
0x80098268,__rmonReadWordAt
0x800982bc,__rmonMemcpy
0x800982f0,__rmonCopyWords
0x80098360,__rmonReadMem
0x8009855c,__rmonWriteMem
0x800987a8,__rmonListProcesses
0x80098828,__rmonLoadProgram
0x80098834,__rmonGetExeName
0x800988dc,__rmonGetRegionCount
0x8009894c,__rmonGetRegions
0x80098b40,__rmonSendHeader
0x80098bd8,__rmonSendReply
0x80098c80,__rmonSendData
0x80098da0,rmonMain
0x80098f40,__rmonMaskIdleThreadInts
0x80098fbc,__rmonGetTCB
0x8009903c,__rmonStopUserThreads
0x80099144,__rmonListThreads
0x80099278,__rmonGetThreadStatus
0x8009956c,__rmonThreadStatus
0x800995d4,__rmonStopThread
0x8009971c,__rmonRunThread
0x800999c0,__rmonSetFault
0x80099a0c,__rmonInit
0x80099ae8,__rmonPanic
0x80099b08,__rmonSetComm
0x80099b50,__rmonRCPrunning
0x80099b74,__rmonIdleRCP
0x80099bb8,__rmonStepRCP
0x80099bcc,__rmonRunRCP
0x80099d84,__rmonSetBreak
0x80099f44,__rmonListBreak
0x80099f50,__rmonClearBreak
0x8009a0ac,__rmonGetBranchTarget
0x8009a368,__rmonSetSingleStep
0x8009a42c,__rmonGetExceptionStatus
0x8009a528,__rmonHitBreak
0x8009a558,__rmonHitSpBreak
0x8009a5c0,__rmonHitCpuFault
0x8009a988,__rmonGetGRegisters
0x8009aae4,__rmonSetGRegisters
0x8009ac34,__rmonGetFRegisters
0x8009acec,__rmonSetFRegisters
0x8009ae04,__rmonGetSRegs
0x8009af64,__rmonSetSRegs
0x8009b074,__rmonGetVRegs
0x8009b18c,__rmonSetVRegs
0x8009b250,__rmonGetRegisterContents
0x800a37b0,__osRcpImTable
0x800a3eb0,__libm_qnan_f
0x800CF0B8,ActorSpawn
0x800C8FE0,set_actor_size`;

window.majora_mask_symtable = majora_mask_symtable;

export class Symbol {
  constructor(name, address) {
    this.name = name;
    this.address = address;
  }
  
  loadJSON(obj) {
    this.name = obj.name;
    this.address = obj.address;
  }
}

//okay, so actually this should RAMCodeModel, it doesn't map the ROM
export class ROMCodeModel {
  constructor() {
    this.tags = new TagManager();
    this.locs = {};
    this.totloc = 0;
    
    this.symbols = {};
    this.loadSymTable(majora_mask_symtable);
    
    this.structs = new StructManager();
  }
  
  fetchMemory(addr, size) {
    if (size === undefined) {
      throw new Error("missing size argument");
    }
    /*
    return new Promise((accept, reject) => {
      let data = [];
      for (let i=0; i<size; i++) {
        data.push(~~(Math.random()*255));
      }
      
      accept(data);
    });//*/
    
    return new Promise((accept, reject) => {
        rpc.exec("myReadBlock8", [addr, size]).then((block) => {
          for (let i=0; i<block.length; i++) {
            if (block[i] === true)
              block[i] = 1;
            if (block[i] === false)
              block[i] = 0;
          }
          accept(block);
        });
    });
  }
  
  mapSymbol(addr, to_hex_if_not_found=true) {
    if (addr in this.symbols) {
      return this.symbols[addr].name;
    }
    
    return to_hex_if_not_found ? addr.toString(16)+"h" : addr;
  }
  
  loadSymTable(buf) {
    let lines = buf.split("\n");
    for (let l of lines) {
      l = l.trim().split(",");
      
      let key = parseInt(l[0].trim()), val = l[1].trim();
      let sym = new Symbol(val, key);
      
      this.symbols[key] = sym;
    }
  }
  
  addSymbol(name, addr) {
    console.trace()
    
    if (addr in this.symbols) {
      this.symbols[addr].name = name;
      
      globevt.fire(EVT.SYMBOL_UPDATE, addr);
      return this.symbols[addr];
    }
    
    let sym = new Symbol(name, addr);
    this.symbols[addr] = sym;
    
    globevt.fire(EVT.SYMBOL_UPDATE|evt.ADD_SYMBOL, addr);

    return sym;
  }
  
  setTag(tagtype, start, end, tag) {
    if (tag === undefined) {
      throw new Error("tag cannot be undefined");
    }
    
    return this.tags.createTag(tag, tagtype, start, end-start);
  }
  
  getTag(tagtype, addr) {
    return this.tags.maps[tagtype].get(addr);
  }
  
  on_tick() {
    this.tags.on_tick();
  }
  
  removeSymbol(addr) {
    if (addr in this.symbols) {
      globevt.fire(EVT.SYMBOL_UPDATE|evt.DEL_SYMBOL, this.symbols[addr]);
    }
    
    delete this.symbols[addr];
  }
  
  getSymbol(addr) {
    return this.symbols[addr];
  }
  
  recordFuncCalls() {
    let ADDR_ANY;
    
    rpc.exec("getVar", ["ADDR_ANY"]).then((value) => {
      ADDR_ANY = value;
      console.log("ADDR_ANY", ADDR_ANY);
      
      let J = 2, JAL = 3;
      let op2 = flip_endian(JAL);
      
      let mask = (1<<30) + (1<<29) + (1<<28);
      mask += (1<<27) + (1<<26);
      mask += Math.pow(2, 31);

      //mask = flip_endian(mask);
      
      let handle = (inst) => {
        let pc = inst.srcpc, opcode = inst.inst;
        
        //opcode = flip_endian(opcode);
        //console.log(dis.loadOpCode(pc, opcode), flip_endian(opcode & mask));
        let decode = dis.loadOpCode(pc, opcode);
        let opname = decode.name;
        
        if (decode.name != "JAL") {
          console.log("bad instruction?");
          return;
        }
        
        let addr = decode.data !== undefined ? decode.data.realtarget : 0;
        //addr = inst.pc;
        
        
        //heuristic, try to detect real long jumps
        if (Math.abs(addr - inst.srcpc) < 1024*2) {
          return;
        }
        
        //majora mask's lower code bound?
        if (Math.abs(addr) > 0x8009b250) {
          return;
        }
        
        if (!(addr in this.locs)) {
          this.locs[addr] = {
            address : addr,
            pc : pc,
            count : 0,
            gpr : inst.gpr
          };
          this.totloc++;
        }
        
        this.locs[addr].count++;
        console.log(this.totloc + " " +
                  this.locs[addr].count + ":", 
                  opcode, 
                  pc,
                  this.mapSymbol(addr),
                  this.mapSymbol(inst.pc),
                  opname,
                  inst.srcpc - inst.pc,
                  inst.srcpc - addr
                  );
        
        //console.log(opcode, pc, addr, opname);
      }
      
      let callback = (inst_data) => {
        for (let inst of inst_data) {
          handle(inst);
        }
        
        //stop recording to avoid overload
        rpc.exec("eventsys.clear", []);
        
        return;
      }
      
      rpc.exec("eventsys.onopcode", [ADDR_ANY, op2, mask, callback]);
    });
  }
  
  toJSON() {
    let ret = {
      locs : this.locs,
      symbols : this.symbols,
      structs : this.structs,
      tags    : this.tags
    }
    
    return ret;
  }
  
  loadJSON(obj) {
    this.totloc = 0;
    this.locs = {};
    this.tags = new TagManager();
    
    for (let k in obj.locs) {
      this.locs[k] = obj.locs[k];
      this.totloc++;
    }
    
    this.symbols = {};
    
    for (let k in obj.symbols) {
      let sym = new Symbol();
      sym.loadJSON(obj.symbols[k]);
      
      this.symbols[k] = sym;
    }
        
    this.structs = new StructManager();
    
    if (obj.structs !== undefined) {
      this.structs.loadJSON(obj.structs);
    }
    
    if (obj.tags !== undefined) {
      this.tags.loadJSON(obj.tags);
    }
    
    return this;
  }
};

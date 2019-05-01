import * as opcode from './opcode.js';

function extract_bits(f, bit, end) {
  let ret = 0;
  let len = end - bit;
  
  for (let i=0; i<len; i++) {
    let b = 1<<(bit + i);
    
    if (f & b) {
      if (i == 31) {
        ret += Math.pow(2, 31);
      } else {
        ret |= 1<<i;
      }
    }
  }
  
  return ret;
}

export let OpTypes = {
  ITYPE : 1, //immediate type
  JTYPE : 2, //jump type
  RTYPE : 4, //register type
}

let ua = new Uint8Array(4);
let ia = new Uint32Array(ua.buffer);

export function flip_endian(f) {
  ia[0] = f;
  
  let a = ua[0], b = ua[1], c = ua[2], d = ua[3];
  
  ua[0] = d;
  ua[1] = c;
  ua[2] = b;
  ua[3] = a;
  
  return ia[0];
}

window.flip_endian = flip_endian;

export class OpCode {
  constructor(type) {
    this.type = type
  }
}

export let Endian = {
  BIG : 0,
  LITTLE : 1
};

export class OpI extends OpCode {
  //n is 32 bit BIG ENDIAN opcode
  constructor(n, endian=Endian.BIG) {
    super(OpTypes.ITYPE);
    
    //if (endian == Endian.BIG)
    //  n = flip_endian(n);
    
    this.immediate = extract_bits(n, 0, 16);
    this.rt = extract_bits(n, 16, 21);
    this.rs = extract_bits(n, 21, 26);
    this.op = extract_bits(n, 26, 32);
  }
}

export class OpJ extends OpCode {
  constructor(n, endian=Endian.BIG) {
    super(OpTypes.JTYPE);
    
    //if (endian == Endian.BIG)
    //  n = flip_endian(n);
    
    this.target = extract_bits(n, 0, 26);
    this.op = extract_bits(n, 26, 32);
  }
  
  calcAddr(pc) {
    let r = this.target<<2;
    let bits = (1<<30) | (1<<29) | (1<<28);
    let lastbit = (pc & (1<<31)) != 0;
    
    pc = pc & bits;
    
    //avoid auto-negativization
    if (lastbit) {
      pc += Math.pow(2, 31);
    }
    
    return pc + r;
  }
}

export class OpR extends OpCode {
  constructor(n, endian=Endian.BIG) {
    super(OpTypes.RTYPE);
    
    //if (endian == Endian.BIG)
    //  n = flip_endian(n);
    
    this.funct = extract_bits(n, 0, 6);
    this.sa = extract_bits(n, 6, 11);
    this.rd = extract_bits(n, 11, 16);
    this.rt = extract_bits(n, 16, 21);
    this.rs = extract_bits(n, 21, 26);
    this.op = extract_bits(n, 26, 32);
  }
}

export function loadOpCode(pc, code) {
  let op = extract_bits(code, 26, 32);
  let ret, type; 
  let ocs = opcode.OpCodeSpecials;
  
  if (code == 0) {
    return {
      op : NOP,
      name : "NOP"
    }
  }
  
  if (op == 0) { //special op!
    op = extract_bits(code, 0, 6);
    
    let type, data;
    
    if (op == ocs.SPECIAL_JALR ||
        op == ocs.SPECIAL_JR) 
    {
      type = OpTypes.RTYPE;
      
      code |= op << 26;
      ret = new OpR(code);
    }
    
    return {
      special : true,
      op : op,
      name : opcode.SpecialMap[op],
      data : ret,
      type : type
    }
  }
  //console.log("op", op, opcode.OpNameMap[op]);
  
  if (opcode.IOps.has(op)) {
    ret = new OpI(code, false);
    type = OpTypes.ITYPE;
  } else if (opcode.JOps.has(op)) {
    ret = new OpJ(code, false);
    ret.realtarget = ret.calcAddr(pc);
    type = OpTypes.JTYPE;
  } else if (opcode.ROps.has(op)) {
    ret = new OpR(code, false);
    type = OpTypes.RTYPE;
  }
  
  if (ret === undefined) {
    return {
      name : opcode.OpNameMap[op],
      code : code,
      op   : op,
      type : "unknown"
    };
  } else {
    return {
      name : opcode.OpNameMap[op],
      op   : op,
      code : code,
      type : type,
      data : ret
    };
  }
}

window.loadOpCode = loadOpCode;

let op_descrtable = `
LB Load Byte
LBU Load Byte Unsigned
LH Load Halfword
LHU Load Halfword Unsigned
LW Load Word
LWL Load Word Left
LWR Load Word Right
SB Store Byte
SH Store Halfword
SW Store Word
SWL Store Word Left
SWR Store Word Right
ADDI Add Immediate
ADDIU Add Immediate Unsigned
SLTI Set on Less Than Immediate
SLTIU Set on Less Than Immediate Unsigned
ANDI AND Immediate
ORI OR Immediate
XORI Exclusive OR Immediate
LUI Load Upper Immediate
MULT Multiply
MULTU Multiply Unsigned
DIV Divide
DIVU Divide Unsigned
MFHI Move From HI
MTHI Move To HI
MFLO Move From LO
MTLO Move To LO
J Jump
JAL Jump And Link
JR Jump Register
JALR Jump And Link Register
BEQ Branch on Equal
BNE Branch on Not Equal
BLEZ Branch on Less Than or Equal to Zero
BGTZ Branch on Greater Than Zero
BLTZ Branch on Less Than Zero
BGEZ Branch on Greater Than or Equal to Zero
BLTZAL Branch on Less Than Zero And Link
BGEZAL Branch on Greater Than or Equal to Zero And Link
SLL Shift Left Logical
SRL Shift Right Logical
SRA Shift Right Arithmetic
SLLV Shift Left Logical Variable
SRLV Shift Right Logical Variable
SRAV Shift Right Arithmetic Variable
LWCz Load Word to Coprocessor z
SWCz Store Word from Coprocessor z
MTCz Move To Coprocessor z
MFCz Move From Coprocessor z
CTCz Move Control to Coprocessor z
CFCz Move Control From Coprocessor z
COPz Coprocessor Operation z
BCzT Branch on Coprocessor z True
BCzF Branch on Coprocessor z False
SYSCALL System Call
BREAK Break
LD Load Doubleword
LDL Load Doubleword Left
LDR Load Doubleword Right
LL Load Linked
LLD Load Linked Doubleword
LWU Load Word Unsigned
SC Store Conditional
SCD Store Conditional Doubleword
SD Store Doubleword
SDL Store Doubleword Left
SDR Store Doubleword Right
SYNC Sync
DADDI Doubleword Add Immediate
DADDIU Doubleword Add Immediate Unsigned
DMULT Doubleword Multiply
DMULTU Doubleword Multiply Unsigned
DDIV Doubleword Divide
DDIVU Doubleword Divide Unsigned
BEQL Branch on Equal Likely
BNEL Branch on Not Equal Likely
BLEZL Branch on Less Than or Equal to Zero Likely
BGTZL Branch on Greater Than Zero Likely
BLTZL Branch on Less Than Zero Likely
BGEZL Branch on Greater Than or Equal to Zero Likely
BLTZALL Branch on Less Than Zero And Link Likely
BGEZALL Branch on Greater Than or Equal to Zero And Link Likely
BCzTL Branch on Coprocessor z True Likely
BCzFL Branch on Coprocessor z False Likely
DADD Doubleword Add
DADDU Doubleword Add Unsigned
DSUB Doubleword Subtract
DSUBU Doubleword Subtract Unsigned
DSLL Doubleword Shift Left Logical
DSRL Doubleword Shift Right Logical
DSRA Doubleword Shift Right Arithmetic
DSLLV Doubleword Shift Left Logical Variable
DSRLV Doubleword Shift Right Logical Variable
DSRAV Doubleword Shift Right Arithmetic Variable
DSLL32 Doubleword Shift Left Logical + 32
DSRL32 Doubleword Shift Right Logical + 32
DSRA32 Doubleword Shift Right Arithmetic + 32
TGE Trap if Greater Than or Equal
TGEU Trap if Greater Than or Equal Unsigned
TLT Trap if Less Than
TLTU Trap if Less Than Unsigned
TEQ Trap if Equal
TNE Trap if Not Equal
TGEI Trap if Greater Than or Equal Immediate
TGEIU Trap if Greater Than or Equal Immediate Unsigned
TLTI Trap if Less Than Immediate
TLTIU Trap if Less Than Immediate Unsigned
TEQI Trap if Equal Immediate
TNEI Trap if Not Equal Immediate
DMFCz Doubleword Move From Coprocessor z
DMTCz Doubleword Move To Coprocessor z
LDCz Load Double Coprocessor z
SDCz Store Double Coprocessor z
DMFC0 Doubleword Move From CP0
DMTC0 Doubleword Move To CP0
MTC0 Move to CP0
MFC0 Move from CP0
TLBR Read Indexed TLB Entry
TLBWI Write Indexed TLB Entry
TLBWR Write Random TLB Entry
TLBP Probe TLB for Matching Entry
CACHE Cache Operation
ERET Exception Return
CP0 Move Control To Coprocessor 0
CP1 Move Control To Coprocessor 1
`;

let table = {};

for (let line of op_descrtable.split("\n")) {
  line = line.split(" ");
  let op = line[0];
  let str = "";
  
  for (let i=1; i<line.length; i++) {
    str += " " + line[i];
  }
  
  table[op] = str;
}

export let OpInfoTable = table;
window.OpInfoTable = table;

/*
union OPCODE
{
    uint32_t Hex;
    uint8_t Ascii[4];

    struct
    {
        unsigned offset : 16;
        unsigned rt : 5;
        unsigned rs : 5;
        unsigned op : 6;
    };

    struct
    {
        unsigned immediate : 16;
        unsigned : 5;
        unsigned base : 5;
        unsigned : 6;
    };

    struct
    {
        unsigned target : 26;
        unsigned : 6;
    };

    struct
    {
        unsigned funct : 6;
        unsigned sa : 5;
        unsigned rd : 5;
        unsigned : 5;
        unsigned : 5;
        unsigned : 6;
    };

    struct
    {
        unsigned : 6;
        unsigned fd : 5;
        unsigned fs : 5;
        unsigned ft : 5;
        unsigned fmt : 5;
        unsigned : 6;
    };

	struct
	{
		unsigned : 6;
		unsigned code : 20;
		unsigned : 6;
	};
};
*/



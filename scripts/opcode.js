export let RegNames = [
  'r0', 'at', 'v0', 'v1', 'a0', 'a1', 'a2', 'a3',
  't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7',
  's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
  't8', 't9', 'k0', 'k1', 'gp', 'sp', 'fp', 'ra'
];

export let OpCodes = {
    NOP : 0, REGIMM : 1, J : 2, JAL : 3,
    BEQ : 4, BNE : 5, BLEZ : 6, BGTZ : 7,
    ADDI : 8, ADDIU : 9, SLTI : 10, SLTIU : 11,
    ANDI : 12, ORI : 13, XORI : 14, LUI : 15,
    CP0 : 16, CP1 : 17, BEQL : 20, BNEL : 21,
    BLEZL : 22, BGTZL : 23, DADDI : 24, DADDIU : 25,
    LDL : 26, LDR : 27, LB : 32, LH : 33,
    LWL : 34, LW : 35, LBU : 36, LHU : 37,
    LWR : 38, LWU : 39, SB : 40, SH : 41,
    SWL : 42, SW : 43, SDL : 44, SDR : 45,
    SWR : 46, CACHE : 47, LL : 48, LWC1 : 49,
    LDC1 : 53, LD : 55, SC : 56, SWC1 : 57,
    SDC1 : 61, SDC2 : 62, SD : 63
}; 

export let OpCodeSpecials = {
    SPECIAL_SLL : 0, SPECIAL_SRL : 2, SPECIAL_SRA : 3,
    SPECIAL_SLLV : 4, SPECIAL_SRLV : 6, SPECIAL_SRAV : 7,
    SPECIAL_JR : 8, SPECIAL_JALR : 9, SPECIAL_SYSCALL : 12,
    SPECIAL_BREAK : 13, SPECIAL_SYNC : 15, SPECIAL_MFHI : 16,
    SPECIAL_MTHI : 17, SPECIAL_MFLO : 18, SPECIAL_MTLO : 19,
    SPECIAL_DSLLV : 20, SPECIAL_DSRLV : 22, SPECIAL_DSRAV : 23,
    SPECIAL_MULT : 24, SPECIAL_MULTU : 25, SPECIAL_DIV : 26,
    SPECIAL_DIVU : 27, SPECIAL_DMULT : 28, SPECIAL_DMULTU : 29,
    SPECIAL_DDIV : 30, SPECIAL_DDIVU : 31, SPECIAL_ADD : 32,
    SPECIAL_ADDU : 33, SPECIAL_SUB : 34, SPECIAL_SUBU : 35,
    SPECIAL_AND : 36, SPECIAL_OR : 37, SPECIAL_XOR : 38,
    SPECIAL_NOR : 39, SPECIAL_SLT : 42, SPECIAL_SLTU : 43,
    SPECIAL_DADD : 44, SPECIAL_DADDU : 45, SPECIAL_DSUB : 46,
    SPECIAL_DSUBU : 47, SPECIAL_TGE : 48, SPECIAL_TGEU : 49,
    SPECIAL_TLT : 50, SPECIAL_TLTU : 51, SPECIAL_TEQ : 52,
    SPECIAL_TNE : 54, SPECIAL_DSLL : 56, SPECIAL_DSRL : 58,
    SPECIAL_DSRA : 59, SPECIAL_DSLL32 : 60, SPECIAL_DSRL32 : 62,
    SPECIAL_DSRA32 : 63,
    REGIMM_BLTZ : 0, REGIMM_BGEZ : 1, REGIMM_BLTZL : 2,
    REGIMM_BGEZL : 3, REGIMM_TGEI : 8, REGIMM_TGEIU : 9,
    REGIMM_TLTI : 10, REGIMM_TLTIU : 11, REGIMM_TEQI : 12,
    REGIMM_TNEI : 14, REGIMM_BLTZAL : 16, REGIMM_BGEZAL : 17,
    REGIMM_BLTZALL : 18, REGIMM_BGEZALL : 19
};

let sm = {};
for (let k in OpCodeSpecials) {
  sm[OpCodeSpecials[k]] = k;
}

export let SpecialMap = sm;

export let OpCodeCops = { //coprocessor opcodes
    //BCzF
    COP0_BC  : 0xBC0F,
    COP1_BC  : 0xBC1F,
    COP2_BC  : 0xBC2F,
    
    COP0_MF : 0, COP0_MT : 4,
    COP0_CO_TLBR : 1, COP0_CO_TLBWI : 2, COP0_CO_TLBWR : 6,
    COP0_CO_TLBP : 8, COP0_CO_ERET : 24,
    COP1_MF : 0, COP1_DMF : 1, COP1_CF : 2, COP1_MT : 4,
    COP1_DMT : 5, COP1_CT : 6, COP1_BC : 8, COP1_S : 16,
    COP1_D : 17, COP1_W : 20, COP1_L : 21,
    COP1_BC_BCF : 0, COP1_BC_BCT : 1, COP1_BC_BCFL : 2,
    COP1_BC_BCTL : 3,
    COP1_FUNCT_ADD : 0, COP1_FUNCT_SUB : 1, COP1_FUNCT_MUL : 2,
    COP1_FUNCT_DIV : 3, COP1_FUNCT_SQRT : 4, COP1_FUNCT_ABS : 5,
    COP1_FUNCT_MOV : 6, COP1_FUNCT_NEG : 7, COP1_FUNCT_ROUND_L : 8,
    COP1_FUNCT_TRUNC_L : 9, COP1_FUNCT_CEIL_L : 10, COP1_FUNCT_FLOOR_L : 11,
    COP1_FUNCT_ROUND_W : 12, COP1_FUNCT_TRUNC_W : 13, COP1_FUNCT_CEIL_W : 14,
    COP1_FUNCT_FLOOR_W : 15, COP1_FUNCT_CVT_S : 32, COP1_FUNCT_CVT_D : 33,
    COP1_FUNCT_CVT_W : 36, COP1_FUNCT_CVT_L : 37, COP1_FUNCT_C_F : 48,
    COP1_FUNCT_C_UN : 49, COP1_FUNCT_C_EQ : 50, COP1_FUNCT_C_UEQ : 51,
    COP1_FUNCT_C_OLT : 52, COP1_FUNCT_C_ULT : 53, COP1_FUNCT_C_OLE : 54,
    COP1_FUNCT_C_ULE : 55, COP1_FUNCT_C_SF : 56, COP1_FUNCT_C_NGLE : 57,
    COP1_FUNCT_C_SEQ : 58, COP1_FUNCT_C_NGL : 59, COP1_FUNCT_C_LT : 60,
    COP1_FUNCT_C_NGE : 61, COP1_FUNCT_C_LE : 62, COP1_FUNCT_C_NGT : 63,
};

let tn = {};

//hoist to global namespace
for (let k in OpCodes) {
  window[k] = OpCodes[k];
  tn[OpCodes[k]] = k;
}
for (let k in OpCodeCops) {
  window[k] = OpCodeCops[k];
  tn[OpCodeCops[k]] = k;
}

for (let k in OpCodes) {
  tn[OpCodes[k]] = k;
}

export let OpNameMap = tn;


//immediate ops
export let IOps = new Set([
  ADDI,
  ANDI,
  ORI,
  XORI,
  ADDIU,
  COP0_BC,
  COP1_BC,
  COP2_BC,
  LUI,
  SB,
  SD,
  SW,
  LW,
  LBU,
  LUI,
  SH,
  LHU,
  BNE,
  BEQ,
  BEQL,
  BNEL,
  BLEZL
]);

//jump ops
export let JOps = new Set([
  J,
  JAL,
]);

//register ops
export let ROps = new Set([
  LW,
  CP0,
  CP1
]);

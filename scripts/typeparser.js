import {parser, token, tokdef, lexer, PUTLParseError} from './parseutil.js';
import {StructTypes, Type} from './structdef.js';

let td = (name, re, func) => new tokdef(name, re, func);

let strlit_re = /('.*')|(".*")/

let tokens = [
  td("INT", /[0-9]+[0-9]*/, (tok) => {
    tok.value = parseInt(tok.value);
    return tok;
  }),
  td("hex", /(0x[0-9a-fA-F]+[0-9a-fA-F]*)|([0-9a-fA-F]+[0-9a-fA-F]*h)/, (tok) => {
    tok.type = "INT";
    if (!tok.value.startsWith("0x")) {
      tok.value = "0x" + tok.value.slice(0, tok.value.length-1);
    }
    
    tok.value = parseInt(tok.value);
    return tok;
  }),
  td("ID", /[a-zA-Z_$]+[a-zA-Z_$0-9]*/),
  td("LPAREN", /\(/),
  td("RPAREN", /\)/),
  td("LSBRACKET", /\[/),
  td("RSBRACKET", /\]/),
  td("LBRACKET", /\{/),
  td("RBRACKET", /\}/),
  td("PLUS", /\+/),
  td("MINUS", /\-/),
  td("TIMES", /\*/),
  td("DIV", /\\/),
  td("BAND", /\&/),
  td("LAND", /\&\&/),
  td("BOR", /\|/),
  td("LOR", /\|\|/),
  td("EQ", /\=\=/),
  td("LEQ", /\<\=/),
  td("GEQ", /\>\=/),
  td("GT", /\>/),
  td("LT", /\</),
  td("COLON", /\:/),
  td("SEMI", /\;/),
  td("COMMA", /\,/),
  td("PERIOD", /\./),
  td("ARROW", /\-\>/),
  td("STRLIT", strlit_re)
];

let BinOps = new Set([
  "PLUS", "MINUS", "EQ", "GEQ", "LEQ", "GT", "LT", "DIV", "TIMES", "BAND", "LAND", "BOR", "LOR"
]);

export function ParseType(buf) {    
  let lasterror = undefined;
  
  let tryerror = (tok) => {
    if (tok === undefined) {
      lasterror = ["parse error"];
    } else {
      lasterror = ["parse error", tok];
    }
  }

  let errfunc = (t) => {
    console.log("parse error", t);
  }
  
  let l = new lexer(tokens, errfunc);
  let p = new parser(l, errfunc);

  let valuemap = {
    "float" : StructTypes.FLOAT32,
    "double" : StructTypes.FLOAT64,
    "int" : StructTypes.INT32,
    "uint" : StructTypes.UINT32,
    "short" : StructTypes.INT16,
    "ushort" : StructTypes.UINT16,
    "char" : StructTypes.INT8,
    "uchar" : StructTypes.UINT8,
  };
  
  function type_from_id(id) {
    if (id in valuemap) {
      return valuemap[id];
    }
    
    return StructTypes.STRUCT;
  }
  
  function p_const(p) {
    return p.expect("INT");
  }
  
  function p_binop(p) {
    let a = p.try(p_const);
    a = a || p_expr(p);
    
    let t = p.next();
    
    if (t === undefined) throw new PUTLParseError("expected binop");
    
    if (!BinOps.has(t.type)) {
      throw new PUTLParseError("expected binop");
    }
    
    let b = p.try(p_const);
    b = b || p_expr(p);
    
    return {
      binop : true,
      a : a,
      b : b,
      op : t.value
    };
  }
  
  function p_expr(p) {
    let op = {w : -1};
    
    const priority = {
      "**" : 0,
      "*" : 1,
      "/" : 1,
      "+" : 2,
      "-" : 2,
      "||" : 3,
      "&&" : 3,
      ">" : 4,
      "<" : 4,
      ">=" : 4,
      "<=" : 4
    };
    
    while (!p.at_end()) {
      let t = p.next();
      
      if (t.type == "INT") {
        op.b = t.value;
      } else if (t.type == "ID") {
        op.b = t.value;
      } else if (BinOps.has(t.type)) {
        let w = priority[t.value];
        
        if (w < op.w) {
          op = {
            a : op,
            op : t.value,
            w : w
          }
        } else {
          let op2 = {
            op : t.value,
            w : w
          }
          
          op.b = op2;
          op = {
            a : op,
            w : -1
          }
        }
      } else if (t.type == "RPAREN" || t.type == "RBRACKET" || t.type == "RSBRACKET") {
        break;
      }
    }
    return op;
    let t = p.peeknext();
    
    if (t.type == "LPAREN") {
      return p_lparen(p);
    }
    
    let ret = p.try(p_binop);
    ret = ret || p.try(p_const);
    
    if (ret === undefined) {
      throw new PUTLParseError("error in p_expr");
    }

    /*else if (t.type == "INT") {
      p.next();
      
      return t.value;
    }*/
    
    return ret;
  }
  
  function p_cast(p) {
    p.expect("LPAREN");
    
    let id = p.expect("ID")
    
    let type = type_from_id(id);
    type = new Type(type, type == StructTypes.STRUCT ? id : undefined, id);
    
    while (!p.at_end() && p.peeknext().type != "RPAREN") {
      let t = p.next();
      
      if (t.type == "TIMES") {
        type = new Type(StructTypes.POINTER, type, "pointer");
      } else if (t.type == "LSBRACKET") {
        let size = p.expect("INT");
        
        type = new Type(StructTypes.ARRAY, type, "array");
        type.size = size;
      }
    }
    
    p.expect("RPAREN");
    
    return type;
  }
  
  function p_parenexpr(p) {
    p.expect("LPAREN");
    let ret = p_expr(p);
    p.expect("RPAREN");
    
    return ret;
  }
  
  function p_lparen(p) {
    let ret = p.try(p_cast);
    
    ret = ret || p.try(p_parenexpr);
    
    if (ret === undefined) {
      let error = "ERROR: ";
      lasterror = lasterror === undefined ? ["unknown error"] : lasterror;
      for (let arg of lasterror) {
        console.log(arg);
        error += arg + " ";
      }
      
      throw new PUTLParseError(error);
    }
    
    return ret;
  }
  
  function p_root() {
    let t = p.peeknext();
    
    console.log(t.type)
    if (t.type == "INT") {
      p.next();
      
      let type = t.value < 0 ? StructTypes.INT32 : StructTypes.UINT32;
      return new Type(type, t.value, "constant");
    } else if (t.type == "LPAREN") {
      return p_lparen(p);
    }
  }
  
  p.start = p_root;
  return p.parse(buf);
}

window._ParseType = ParseType;

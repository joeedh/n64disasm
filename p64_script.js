"use strict";

var PORT = 5005;

this.globals = this;

//handy func to split json messages that arrive in batches

function json_split_multiple(buf) {
  var depth = 0;
  
  if (typeof buf[0] == "number") {
    var buf2 = "";
    
    for (var i=0; i<buf.length; i++) {
      buf2 += String.fromCharCode(buf[i]);
    }
    buf = buf2;
  }
  
  console.log("-=======-");
  console.log(buf);
  console.log("=========");
  
  var s = "";
  var ret = [];
  
  for (var i=0; i<buf.length; i++) {
    var c = buf[i];
    
    if (c == "{") {
      depth++;
      s += c;
    } else if (c == "}") {
      depth--;
      
      if (depth <= 0) {
        depth = 0; //XXX
        s += "}";
        
        ret.push(s.trim());
        
        s = "";
      } else {
        s += c;
      }
    } else {
      s += c;
    }
  }
  
  s = s.trim();
  if (s.length > 0) {
    ret.push(s);
  }
  
  for (var i=0; i<ret.length; i++) {
    console.log("-=-=-=");
    console.log(ret[i]);
    console.log("-=-=-=");
    ret[i] = JSON.parse(ret[i]);
  }
  
  return ret;
}

globals.eventsys = new (function() {
  this.callbacks = {};
  
  this.onopcode = function(addr, val, mask, cb) {
    if (typeof mask == "function") {
      cb = mask;
      mask = 0xFFFFFFFF;
    }
    
    var opqueue = [];
    var callback2 = cb;
    
    var gprnames = ['r0', 'at', 'v0', 'v1', 'a0', 'a1', 'a2', 'a3',
        't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7',
        's0', 's1', 's2', 's3', 's4', 's5', 's6', 's7',
        't8', 't9', 'k0', 'k1', 'gp', 'sp', 'fp', 'ra'
    ];
    
    function callback(pc) {
      var gpr1 = {};
      
      for (var i=0; i<gprnames.length; i++) {
        gpr1[gprnames[i]] = gpr[gprnames[i]];
      }
      
      var f31 = gpr1.f31 = gpr.f31;
      
      var srcaddr = f31 - 8;
      
      opqueue.push({
        pc : pc,
        srcpc : srcaddr,
        inst : mem.u32[srcaddr],
        inst2 : mem.u32[srcaddr-4],
        inst3 : mem.u32[srcaddr+4],
        gpr : gpr1
      });
      
      if (opqueue.length > 100) {
        //console.log(callback2);
        callback2(opqueue);
        opqueue = [];
      }
    }
    
    callback.cb = callback2;
    
    var id = events.onopcode(addr, val, mask, callback);
    this.callbacks[id] = callback;
    
    return id;
  }
  
  this.remove = function(id) {
    if (!(id in this.callbacks)) {
      throw new Error("invalid callback id" + id);
    }
    
    events.remove(id);
    delete this.callbacks[id];
  }
  
  this.clear = function() {
    var list = [];
    
    for (var k in this.callbacks) {
      list.push(~~k);
    }
    
    console.log("clear list:", list);
    
    for (var i=0; i<list.length; i++) {
      this.remove(list[i]);
    }    
  }
})();

globals.myReadBlock = function(addr, len) {
  var ret = [];
  
  for (var i=0; i<len; i += 4) {
    ret.push(mem.u32[addr+i]);
  }
  
  return ret;
}

globals.readU32 = function(addr) {
  return mem.u32[addr];
}
globals.readU16 = function(addr) {
  return mem.u16[addr];
}
globals.readU8 = function(addr) {
  return mem.u8[addr];
}

/*
globals.testOnOpcode = function() {
  function cb(pc) {
    console.log("PC", pc);
  }
  
  events.onopcode(ADDR_ANY, 50331648, 1056964608, cb);
}

globals.testOnOpcode();

//*/

globals.testCallback = function(cb) {
  cb(1, 2, 3, [1, 2, 3], {a : 2, b : [5, 6, 7]});
}

globals.getGlobals = function() {
  var ret = [];
  for (var k in globals) {
    ret.push(k);
  }
  
  return k;
}

globals.getVar = function getVar(path) {
  var path2 = path.split();
  
  var ret = globals;
  
  for (var i=0; i<path2.length; i++) {
    if (!(path2[i] in ret)) {
      throw new Error("bad path \"" + path + "\"");
    }
    
    ret = ret[path2[i]];
  }
  
  return ret;
}

globals.execCode = function execCode(code) {
  console.log(code);
  return eval(code);
}

function Request(data, socket) { 
  this.data = data;
  this.socket = socket;
  
  this.headers = {};
  this.sheaders = [];
}

String.prototype.search = function(str) {
  for (var i=0; i<this.length; i++) {
    var ok = true;
    
    for (var j=0; j<str.length && j+i < this.length; j++) {
      if (this[i+j] != str[j]) {
        ok = false;
        break;
      }
    }
    
    if (ok)
      return i;
  }
  
  return -1;
}

function Request(socket) {
  this.socket = socket;
}

Request.prototype = {
  sendError : function(msg, clientId) {
    msg = JSON.stringify({
      status : "error",
      message : msg,
      clientId : clientId
    });
    
    this.socket.write(msg);
  },
  
  //data is json
  onmessage : function(data) {
    if (data === undefined) {
      this.sendError("not found");
      return;
    }
    
    var name = data.name;
    var id = data.clientId;
    var msgid = data.msgId;
    
    name = name.split(".")
    var func = globals, parent = func;
    
    for (var i=0; i<name.length; i++) {
      parent = func;
      func = func[name[i]];
      
      console.log("'" + name[i] + "'", parent[name[i]]);
      
      if (func === undefined)
        break;
    }
    
    if (func === undefined) {
      this.sendError("bad method", id);
      return;
    }
    
    var args = [];
    var this2 = this;
    function makeCallback(cbid) {
      return function() {
        var args = [];
        for (var i=0; i<arguments.length; i++) {
          args.push(arguments[i]);
        }
        
        var obj = {
          status : "callback",
          callId : cbid,
          clientId : id,
          msgId : msgid,
          args : args
        };
        
        this2.socket.write(JSON.stringify(obj));
      };
    }
    
    for (var i=0; i<data.args.length; i++) {
      var arg = data.args[i];
      if (arg.type == "callback") {
        args.push(makeCallback(arg.value));
      } else if (arg.type == "json") {
        console.log(arg.type, "'"+arg.value+"'");
        args.push(JSON.parse(arg.value));
      } else {
        args.push(arg.value);
      }
    }
    
    //console.log("args", parent, args);
    //console.log("-", typeof args[0]); //args[0].start, args[0].end);
    
    var ret;
    try {
      ret = func.apply(parent, args);
    } catch (error) {
      ret = {
        status : "error",
        message : ""+error,
        clientId : id,
        msgId : msgid
      }
      
      this.socket.write(JSON.stringify(ret));
      return;
    }
    
    ret = {
      status : "ok",
      value : ret,
      clientId : id,
      msgId : msgid
    };
    
    this.socket.write(JSON.stringify(ret));
  },
};

var serv = new Server({});

console.log("starting server on port", PORT);
console.log("starting...");

var callbacks = {};

serv.on("connection", function(socket) {
  //socket.id = socket_idgen++;
  
  console.log("got new connection");
  var req = new Request(socket);
  
  //connections[socket.id] = socket;
  
  socket.on("data", function (data) {
    console.log("got data", data);
    
    var blocks = json_split_multiple(data);
    
    for (var i=0; i<blocks.length; i++) {
      req.onmessage(blocks[i]);
    }
  });
  
  socket.on("close", function() {
    console.log("connection closed");
  });
});

serv.listen(PORT);
console.log("done");

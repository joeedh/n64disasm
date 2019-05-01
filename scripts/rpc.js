var msg_idgen = 1;

export class RPC {
  constructor(address, port) {
    if (address === undefined) {
      address = "127.0.0.1";
    }
    
    if (port === undefined) {
      port = 5001;
    }  
    
    this.ready = false;
    this.addr = address;
    this.port = port;
    
    this.outqueue = [];
    this.inqueue = [];
    
    this.callback_idgen = 0;
    this.callbacks = {};
    
    this.messages = {};
  }
  
  exec(name, args) {
    var obj = {};
    
    let msgid = msg_idgen++;
    
    obj.msgId = msgid;
    obj.name = name;
    obj.status = "ok";
    obj.args = [];
    
    for (var i=0; i<args.length; i++) {
      var arg = {}
      
      if (typeof args[i] == "function") {
        var id = this.callback_idgen++;
        
        this.callbacks[id] = {
          func : args[i],
          msgId : msgid
        };
        
        arg.type = "callback";
        arg.value = id;
      } else if (typeof args[i] == "number") {
        arg.type = "number";
        arg.value = args[i];
      } else if (typeof args[i] == "string") {
        arg.type = "string";
        arg.value = args[i];
      } else if (typeof args[i] == "object") {
        arg.type = "json";
        arg.value = JSON.stringify(args[i]);
      }
      
      obj.args.push(arg);
    }
    
    obj.clientId = this.clientId;
    
    obj = JSON.stringify(obj);
    this.write(obj);
    
    return new Promise((accept, reject) => {
      this.messages[msgid] = {
        accept : accept,
        reject : reject
      };
    });
  }
  
  write(msg) {
    if (this.ws === undefined || this.ws.readyState != WebSocket.OPEN) {
      this.ready = false;
    }
    
    if (!this.ready) {
      console.log("no server; queuing. . .");
      return;
    }
    
    this.outqueue.push(msg);
  }
  
  connect() {
    if (this.ready) {
      return;
    }
    
    this.clientId = ~~(Math.random()*1024*1024);
    
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
    }
    
    if (this.writeTimer !== undefined) {
      window.clearInterval(this.writeTimer);
    }
    
    this.writeTimer = window.setInterval(() => {
      if (this.outqueue.length == 0)
        return;
      if (!this.ready)
        return;
      
      let msg = this.outqueue.pop();
      this.ws.send(msg);    
    }, 75);
    
    //autoreconnection timer
    this.timer = window.setInterval(() => {
      if (!this.ready && (this.ws === undefined || this.ws.readyState == WebSocket.CLOSED)) {
        console.log("auto reconnect to websocket pipe");
        
        this.ws = undefined;
        this.connect();
      }
    }, 500);
    
    console.log("connecting to websocket server");
    this.ws = new WebSocket("ws://" + this.addr + ":" + this.port + "/ws");

    this.ws.addEventListener("message", (e) => {
      var blocks = json_split_multiple(e.data);
      for (let json of blocks) {
        if (json.status == "callback") {
          //console.log("callback!", json.callId);
          
          this.callbacks[json.callId].func.apply(this, json.args);
        } else if (json.msgId !== undefined && json.msgId in this.messages) {
          let promise = this.messages[json.msgId];
          delete this.messages[json.msgId];
          
          if (json.status == "error") {
            promise.reject(json.message);
          } else {
            promise.accept(json.value);
          }
        } else {
          console.log("invalid message id", json.msg_idgen);
        }
      }
    });
    
    this.ws.addEventListener("open", (e) => {
      this.ready = true;
      
      //for (let msg of this.outqueue) {
      //  this.ws.send(msg);
      //}
      
      this.exec("eventsys.clear", []);
      
      //this.outqueue.length = 0;
      console.log("ws open called", e);
    });
    
    this.ws.addEventListener("error", (e) => {
      console.log("ws error called", e);
    });
    
    this.ws.addEventListener("close", (e) => {
      this.ready = false;
      this.ws = undefined;
      console.log("ws close called", e);
    });
  }
};
  
export var rpc = new RPC();

export function connect() {
  rpc.connect();
}

export function exec(name, arg) {
  return rpc.exec(name, arg);
}

export function test() {
  let ADDR_ANY;
  
  rpc.exec("getVar", ["ADDR_ANY"]).then((value) => {
    ADDR_ANY = value;
    console.log("ADDR_ANY", ADDR_ANY);
    
    let callback = (pc) => {
      console.log("J PC", pc);
    }
    let callback2 = (pc) => {
      console.log("JAL PC", pc);
    }
    
    let J = 2, JAL = 3;
    let mask = (1<<6)-1;
    
    let op2 = flip_endian(JAL);
    let mask2 = flip_endian(mask);
    
    rpc.exec("eventsys.onopcode", [ADDR_ANY, op2, mask2, callback]);
    
    //rpc.exec("events.onopcode", [ADDR_ANY, J, mask, callback]).then(() => {
    //});
    
  });
}

export function json_split_multiple(buf) {
  var depth = 0;
  
  if (typeof buf[0] == "number") {
    var buf2 = "";
    for (var i=0; i<buf.length; i++) {
      buf2 += String.fromCharCode(buf[i]);
    }
    buf = buf2;
  }
  
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
    ret[i] = JSON.parse(ret[i]);
  }
  
  return ret;
}

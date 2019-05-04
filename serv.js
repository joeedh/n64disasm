const url = require('url');
const PORT = 5001;
const HOST = "localhost"

const net = require('net');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const INDEX = "index.html"
const SAVEPATH = "data/zelda_mm.json"
const basedir = process.cwd();

let mimemap = {
  ".js" : "application/javascript",
  ".json" : "text/json",
  ".html" : "text/html",
  ".png" : "image/png",
  ".jpg" : "image/jpeg"
};

let getMime = (p) => {
  p = p.toLowerCase().trim();
  
  for (let k in mimemap) {
    if (p.endsWith(k)) {
      return mimemap[k];
    }
  }
  
  return "text/plain";
}

exports.ServerResponse = class ServerResponse extends http.ServerResponse {
  _addHeaders() {
    this.setHeader("X-Content-Type-Options", "nosniff");
    this.setHeader("Access-Control-Allow-Origin", "*");
  }

  sendError(code, message) {
    let buf = `<!doctype html>
<html>
<head><title>404</title></head>
<body><div>${message}<div><body>
</html>
`;

    this.statusCode = code;
    this.setHeader('Host', HOST);
    this.setHeader('Content-Type', 'text/html');
    this.setHeader('Content-Length', buf.length);
    this._addHeaders();
    
    this.writeHead(code).end(buf);
  }
}

let performance = require('perf_hooks').performance ;
let time_ms = () => {
  return performance.now();
};

let _saving = undefined;
let _last_false = undefined;

setInterval(() => {
  if (!_saving) {
    _last_false = time_ms();
  }
  
  if (time_ms() - _last_false > 4000) {
    console.warn("Timeout detected in save code");
    _saving = false;
  }
}, 50);

function cycleData(p, data, totcycles=4096) {
  if (_saving) {
    console.warn("RACE CONDITITON IN NODE");
    return false;
  }
  _saving = true;
  
  p = path.normalize(p);
  
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, data);
    console.log("writing", p);
    _saving = false;
    return true;
  }
  
  let buf = fs.readFileSync(p, "ascii");
  if (buf == data) {
    console.log("file was same");
    _saving = false;
    return true;
  } else {
    let ret = true;
    
    try {
      console.log("saving. . .");
      fs.renameSync(p, p + "._");
      fs.writeFileSync(p, data);
      
      let dir = p + ".archive";
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
      }
      
      for (let i=totcycles-1; i >= 1; i--) {
        let p2 = dir + "/" + i + ".json";
        let p3 = dir + "/" + (i+1) + ".json";
        
        //console.log(p2)
        if (fs.existsSync(p2)) {
          //console.log(p2, p3);
          fs.renameSync(p2, p3);
        }
      }
      
      fs.renameSync(p+"._", dir+"/1.json");
    } catch (error) {
      ret = false;
      console.log("ERROR", error);
    }
    
    _saving = false;
    return ret;
  }
  
  _saving = false;
}

const serv = http.createServer({
  ServerResponse : exports.ServerResponse
}, (req, res) => {
  let p = req.url.trim();
  
  if (!p.startsWith("/")) {
    p = "/" + p
  }
  
  console.log(req.method, p);
  
  if (p == "/save") {
    res.writeProcessing();
    
    //console.log("  save api called");
    req.once("data", (msg) => {
      let s = "";
      for (let i=0; i<msg.length; i++) {
        s += String.fromCharCode(msg[i]);
      }
      
      //s = JSON.stringify(JSON.parse(s), undefined, 1);
      console.log(s.length, "<------------");
      
      if (!cycleData(SAVEPATH, s)) {
        res.sendError(500, "save error");
        return;
      }
      
      let buf = JSON.stringify({
        status : "ok",
        recvlen : s.length
      });
      
      console.log("done!", res.finished);
      buf = ""; //"<!doctype html><html><head><title>ok</head></title><body>ok</body></html>";
      res._addHeaders();
      res.sendError(200, "yay");
      /*
      res._addHeaders();
      res.setHeader('Content-Type', "text/plain");
      res.setHeader('Content-Length', "2");
      res.statusCode = 200;
      res.end("ok");
      //*/
      //res.setHeader('Content-Type', "text/plain");
      //res.end(buf);
    });
    
    req.read();
    
    return;
  }
  
  if (p == "/") {
    p += INDEX
  }
  
  p = path.normalize(basedir + p);
  if (p.search(/\.\./) >= 0 || !p.startsWith(basedir)) {
    //normalize failed
    return res.sendError(500, "malformed path");
  }
  
  let stt;
  try {
    stt = fs.statSync(p);
  } catch(error) {
    return res.sendError(404, "bad path");
  }
  
  if (stt === undefined || stt.isDirectory() || !stt.isFile()) {
    console.log("access error for", p);
    return res.sendError(404, "bad path");
  }
  
  
  let mime = getMime(p);
  
  let buf = fs.readFileSync(p);
  
  res.statusCode = 200;
  res.setHeader('Content-Type', mime);
  res._addHeaders();
  res.end(buf);
});


function json_split_multiple(buf) {
  var depth = 0;
  
  if (typeof buf == "object") {
    return [buf];
  }
  
  if (typeof buf[0] == "number") {
    var buf2 = "";
    for (var i=0; i<buf.length; i++) {
      buf2 += String.fromCharCode(buf[i]);
    }
    buf = buf2;
  }
  
  var s = "";
  var ret = [];
  var instr = false;
  
  for (var i=0; i<buf.length; i++) {
    var c = buf[i];
    
    if (c == '"' && !instr) {
      instr = 1;
      s += c;
      continue;
    } else if (c == '"' && instr) {
      s += c;
      continue;
    }
    
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
  
  //console.log("BUF", typeof buf, buf);
  //console.log("RET", ret);
  
  s = s.trim();
  if (s.length > 0) {
    ret.push(s);
  }
  
  for (var i=0; i<ret.length; i++) {
    try {
      ret[i] = JSON.parse(ret[i]);
    } catch(error) {
      console.log(ret[i], error);
    }
  }
  
  return ret;
}

class DebugPipe {
  constructor(addr, port) {
    this.addr = addr;
    this.port = port;
    this.queue = [];
    this.ready = false;
    
    this._eventcbs = {
      'connect' : [],
      'close' : [],
      'error' : [],
      'message' : [],
    };
    
    this.clientcbs = {};
    
    this.reconnect_timer = setInterval(() => {
      if (!this.ready && this.socket === undefined) {
        this.connect();
      }
    }, 500);
    
    this.queue_timer = setInterval(() => {
      if (this.ready && this.socket) {
        this._doQueue();
      }
    }, 75);
    
    this.connect();
  }
  
  emit(msg, data) {
    for (let cb of this._eventcbs[msg]) {
      cb(data);
    }
  }
  
  connect() {
    this.socket = net.createConnection(this.port, this.addr, {
    }, (sock) => {
      this.ready = true;
      console.log("connected!", sock);
    });
    
    this.socket.setEncoding("utf8");
    
    this.socket.on("error", (error) => {
      console.log("socket error");
      this.ready = false;
      this.socket = undefined;
    });
    
    this.socket.on("data", (data) => {
      //console.log("pipe socket data", data);
      var blocks;
      
      try {
        blocks = json_split_multiple(data);
      } catch (error) {
        console.log("failed to parse data", data);
        return;
      }
      
      for (let data2 of blocks) {
        if (!(data2.clientId in this.clientcbs)) {
          console.log("no client callback registered for " + data2.clientId);
          continue;
        }
        
        //console.log(data2);
        this.clientcbs[data2.clientId](data2);
      }
    });
  }
  
  on(type, id, callback) {
    if (type == "clientmessage") {
      this.clientcbs[id] = callback;
      return;
    }
    
    if (!(type in this._eventcbs)) {
      throw new Error("bad event type " + type);
      return;
    }
    
    this._eventcbs[type].push(callback);
  }
  
  send(data) {
    this.queue.push(data);
  }
  
  _send(data) {
    //console.log("sending data", data);
    this.socket.write(data, "utf8");
  }
  
  _doQueue() {
    if (this.queue.length > 0) {
      let msg = this.queue.pop();
      this._send(msg);
    }
  }
  
  close() {
    this._close();
  }
  
  _close() {
    clearInterval(this.reconnect_timer);
    clearInterval(this.queue_timer);
  }
}

const debugpipe = new DebugPipe("127.0.0.1", 5005);

const wserv = new WebSocket.Server({noServer : true});
wserv.on("connection", (ws) => {
  console.log("got websocket connection");
  let clientId;
  
  let ondata = (data) => {
    let blocks = json_split_multiple(data);
    
    //console.log("got data", blocks);
    
    for (let json of blocks) {
      if (ws.readyState == 3) {
        if (Math.random() > 0.999) {
          console.log("dropping data packet", json);
        }
        
        continue;
      }

      ws.send(JSON.stringify(json));
    }
  }
  
  ws.on("message", (e) => {
    //console.log("got websocket message", e);
    
    let blocks = json_split_multiple(e);
    
    for (let obj of blocks) {
      if (clientId === undefined) {
        clientId = obj.clientId;
      
        debugpipe.on("clientmessage", obj.clientId, ondata);
      }
      
      debugpipe.send(JSON.stringify(obj));
    }
  });
});

serv.on("upgrade", (request, socket, head) => {
  const pathname = url.parse(request.url).pathname;
 
  if (pathname === '/ws') {
    console.log("websocket connect!");
    
    wserv.handleUpgrade(request, socket, head, function done(ws) {
      wserv.emit('connection', ws, request);
    });
  } else {
    console.log("bad websocket path");
  }
});

serv.listen(PORT, HOST, () => {
  console.log("Server listening on", HOST + ":" + PORT); 
});











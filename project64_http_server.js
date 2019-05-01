"use strict";

var PORT = 5005;

this.globals = this;

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

Request.prototype = {
  parse : function() {
    var data = this.data;
  
    var i=0;

    function findcrlf(i) {
      for (; i<data.length-1; i++) {
        var c = String.fromCharCode(data[i]);
        var c2 = String.fromCharCode(data[i+1]);
        
        if (c == "\r" && c2 == "\n")
          break;
      }
      
      return i;
    }
    
    var qlen = findcrlf(0);
    
    var path = "";
    for (var j=0; j<qlen; j++) {
      path += String.fromCharCode(data[j]);
    }
    path = path.trim();
    
    path = path.split(" ");
    this.method = path[0].toUpperCase();
    this.path = path[1];
    
    var hlen = findcrlf(qlen+1);
    
    var key = "", val = "";
    var state = 0;
    var lastc = 0;
    var body = "";
    
    for (i=qlen+2; i<data.length; i++) {
      var c = data[i];
      c = String.fromCharCode(c);
      
      if (c == " " || c == "\t") {
        state = 1;
      } else if (c == ":") {
        lastc = c;
        continue;
      } else if (c == "\r") {
        lastc = c;
        continue;
      } else if (c == "\n") {// || c == "\r") {
        key = key.trim();
        
        state = 0;

        //detect crlf-crlf, i.e. there is a body
        if (val.trim().length == 0) {
          for (var j=i+1; j<data.length; j++) {
            body += String.fromCharCode(data[j]);
          }
          
          break;
        }
        this.headers[key] = val;
        
        //console.log("::", key, val, "::");
        
        key = "";
        val = "";
      }
      
      if (state) {
        val += c;
      } else {
        key += c;
      }
      
      lastc = c;
    }
    
    this.body = body;
    console.log("body:", body);
    for (var k in this.headers) {
      console.log("  ", k + ":", this.headers[k]);
    }
    
    if (this.method == "GET") {
      this.handleGET(this.path);
    } else if (this.method == "POST") {
      this.handlePOST(this.path);
    }
  },
  
  sendResponse : function(code, body) {
    this.resHeader("Content-Length", body.length);
    
    var s = "HTTP/1.1 " + code + " None\r\n";
    
    var h = this.sheaders;
    
    for (var i=0; i<h.length; i++) {
      s += h[i][0] + ": " + h[i][1] + "\r\n";
    }
    
    s += "\r\n" + body;
    console.log(s);
    
    this.socket.write(s);
  },
  
  resHeader : function(key, val) {
    this.sheaders.push([key, val]);
  },
  
  sendError : function(code, msg) {
    var body = "{\"error\": " + code + ", \"message\": \"" + msg + "\"}"; 
    
    this.resHeader("Connection", "keep-alive");
    this.resHeader("Content-Type", "application/x-javascript");
    this.resHeader("X-Content-Type-Options", "nosniff");
    this.resHeader("Access-Control-Allow-Origin", "*");
    
    this.sendResponse(code, body);
  },
  
  decodePath : function() {
    var path = this.path;
    
    path = path.split("?");
    this.path = path[0].trim();
    
    this.query = {};
    
    if (path.length < 2) {
      return;
    }
    
    var q = path[1].split("&");
    console.log(path[1]);
    
    for (var i=0; i<q.length; i++) {
      var q2 = q[i].split("=");
      this.query[q2[0].trim()] = q2[1].trim();
    }
    
    console.log(this.path);
    
    for (var k in this.query) {
      console.log(k, this.query[k]);
    }
  },
  
  handlePOST : function() {
    console.log("post ", this.path);
    this.decodePath();
    
    var data;
    
    try {
      data = JSON.parse(this.body);
    } catch (error) {
      this.sendError(500, "not found");
      return;
    }
    
    if (data === undefined) {
      this.sendError(500, "not found");
      return;
    }
    
    var name = data.name;
    
    name = name.split(".")
    var func = globals, parent = func;
    
    for (var i=0; i<name.length; i++) {
      parent = func;
      func = func[name[i]];
      
      if (func === undefined)
        break;
    }
    
    if (func === undefined) {
      this.sendError(404, "bad method");
      return;
    }
    
    var args = [];
    
    for (var i=0; i<data.args.length; i++) {
      var arg = data.args[i];
      args.push(arg.value);
    }
    
    var ret = func.apply(parent, args);
    
    ret = {
      status : "ok",
      value : ret
    };
    
    var body = JSON.stringify(ret);
    
    this.resHeader("Connection", "keep-alive");
    this.resHeader("Content-Type", "text/json");
    this.resHeader("X-Content-Type-Options", "nosniff");
    this.resHeader("Access-Control-Allow-Origin", "*");
    
    this.sendResponse(200, body);
  },
  
  handleGET : function() {
    console.log("get ", this.path);
    
    this.decodePath();
      
    this.sendError(404, "not found");
  }
};

var connections = {};
var socket_idgen = 0;

var serv = new Server({});

console.log("starting server on port", PORT);
console.log("starting...");
console.log("done");

serv.on("connection", function(socket) {
  //socket.id = socket_idgen++;
  
  console.log("got new connection");
  
  //connections[socket.id] = socket;
  
  socket.on("data", function (data) {
    console.log("got data");
    
    var req = new Request(data, socket);
    req.parse();
  });
  
  socket.on("close", function() {
    delete connections[socket.id];
  });
});
serv.listen(PORT);

//api for *a very few* global-level events.
//use sparingly!

export let EventTypes = {
  NEW_STRUCT       : (1<<1),
  DEL_STRUCT       : (1<<2),
  STRUCT_UPDATE    : (1<<3),
  SYMBOL_UPDATE    : (1<<4),
  NEW_SYMBOL       : (1<<5),
  DEL_SYMBOL       : (1<<6),
};
let maxbits = 16;

export let callbacks = [];

export function subscribe(typemask, cb, owner) {
  if (owner === undefined) {
    throw new Error("owner cannot be underfined");
  }
  
  callbacks.push([typemask, cb, owner]);
}

export function unsubscribe(owner) {
  for (let cb of this.callbacks.slice(0, this.callbacks.length)) {
    if (cb[2] == owner)
      this.callbacks.remove(cb);
  }
}

function _fire(event, data) {
  if (typeof event != "number") {
    throw new Error("invalid call to global_events.fire()");
  }
  
  for (let cb of callbacks) {
    if (!(cb[0] & event))
      continue;
    
    try {
      cb[1](event, data);
    } catch (error) {
      print_stack(error);
      console.log("eek error in global_events.fire!");
    }
  }
}

export let queue = [];
let QMASK=0, QDATA=1, QTOT=2;

window.setInterval(function() {
  for (let i=0; i<queue.length; i += QTOT) {
    _fire(queue[i], queue[i+1]);
  }
  
  queue.length = 0;
}, 8);

export function fire(mask, data) {
  for (let i=0; i<maxbits; i++) {
    if (mask & (1<<i)) {
      queue.push(1<<i);
      queue.push(data);
      //_fire(1<<i, data);
    }
  }
}

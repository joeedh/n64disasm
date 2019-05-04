let _parseInt = parseInt;

window.parseInt = (f) => {
  if (typeof f != "string") {
    return _parseInt(f);
  }
  
  f = f.trim();
  
  if (f.endsWith("h")) {
    f = "0x" + f.slice(0, f.length-1);
  }
  
  return _parseInt(f);
}

let _parseFloat = parseFloat;
window.parseFloat = (f) => {
  if (f.search("h") >= 0 || f.search("0x") >= 0) {
    return parseInt(f);
  }
  
  return _parseFloat(f);
}

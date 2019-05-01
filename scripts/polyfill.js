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
const obj = {
  then(res, rej) {
    return new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error("Delayed error")), 200);
    }).then(res, rej);
  }
};
function wrap() {
  return new Promise((resolve, reject) => {
    let completed = false;
    setTimeout(() => {
      completed = true;
      reject(new Error("Timeout!"));
    }, 100);
    obj.then(
      res => { if (!completed) resolve(res); },
      err => { if (!completed) reject(err); }
    );
  });
}
async function run() {
  try { await wrap(); } catch(e) { console.error("Caught timeout"); }
}
run();
setTimeout(() => console.log("done"), 300);

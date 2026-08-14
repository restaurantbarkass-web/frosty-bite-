const p = new Promise((resolve, reject) => {
  setTimeout(() => reject(new Error("Delayed error")), 200);
});
setTimeout(() => console.log("done"), 300);

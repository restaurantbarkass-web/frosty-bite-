const obj = {
  then(resolve, reject) {
    setTimeout(() => {
      reject(new Error("Timeout!"));
    }, 100);
    return new Promise(() => {}); // never settles
  }
};
async function run() {
  try {
    await obj;
    console.log("Success");
  } catch(e) {
    console.log("Caught:", e.message);
  }
}
run();

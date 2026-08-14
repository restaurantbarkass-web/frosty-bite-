const obj = {
  then(resolve, reject) {
    setTimeout(() => {
      reject(new Error("timeout!"));
    }, 100);
  }
};
async function test() {
  try {
    const val = await obj;
    console.log(val);
  } catch (err) {
    console.error("caught:", err.message);
  }
}
test();

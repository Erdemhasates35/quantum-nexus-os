// Preserved compatibility entrypoint: NEXUS V14 stable flashloan entrypoint
void import("./flashloan/engine.mjs")
  .then(({ runFlashloan }) => runFlashloan({ entrypoint: "nexuss_flashloan.js" }))
  .catch((error) => {
    console.error(JSON.stringify({ decision: "ERROR", entrypoint: "nexuss_flashloan.js", message: error.message }));
    process.exitCode = 1;
  });

// Preserved compatibility entrypoint: NEXUS V14 flashloan entrypoint
void import("./flashloan/engine.mjs")
  .then(({ runFlashloan }) => runFlashloan({ entrypoint: "nexus_flashloan.js" }))
  .catch((error) => {
    console.error(JSON.stringify({ decision: "ERROR", entrypoint: "nexus_flashloan.js", message: error.message }));
    process.exitCode = 1;
  });

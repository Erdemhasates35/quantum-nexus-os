// Preserved compatibility entrypoint: NEXUS V14.3 flashloan entrypoint
void import("./flashloan/engine.mjs")
  .then(({ runFlashloan }) => runFlashloan({ entrypoint: "nexussss_flashloan.js" }))
  .catch((error) => {
    console.error(JSON.stringify({ decision: "ERROR", entrypoint: "nexussss_flashloan.js", message: error.message }));
    process.exitCode = 1;
  });

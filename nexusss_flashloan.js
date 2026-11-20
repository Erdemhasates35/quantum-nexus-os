// Preserved compatibility entrypoint: NEXUS V15 flashloan entrypoint
void import("./flashloan/engine.mjs")
  .then(({ runFlashloan }) => runFlashloan({ entrypoint: "nexusss_flashloan.js" }))
  .catch((error) => {
    console.error(JSON.stringify({ decision: "ERROR", entrypoint: "nexusss_flashloan.js", message: error.message }));
    process.exitCode = 1;
  });

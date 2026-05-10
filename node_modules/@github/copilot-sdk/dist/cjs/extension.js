"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var extension_exports = {};
__export(extension_exports, {
  joinSession: () => joinSession
});
module.exports = __toCommonJS(extension_exports);
var import_client = require("./client.js");
var import_types = require("./types.js");
async function joinSession(config = {}) {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    throw new Error(
      "joinSession() is intended for extensions running as child processes of the Copilot CLI."
    );
  }
  const client = new import_client.CopilotClient({ isChildProcess: true });
  return client.resumeSession(sessionId, {
    ...config,
    onPermissionRequest: config.onPermissionRequest ?? import_types.defaultJoinSessionPermissionHandler,
    disableResume: config.disableResume ?? true
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  joinSession
});

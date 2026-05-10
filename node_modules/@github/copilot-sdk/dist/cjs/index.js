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
var index_exports = {};
__export(index_exports, {
  CopilotClient: () => import_client.CopilotClient,
  CopilotSession: () => import_session.CopilotSession,
  SYSTEM_PROMPT_SECTIONS: () => import_types.SYSTEM_PROMPT_SECTIONS,
  approveAll: () => import_types.approveAll,
  convertMcpCallToolResult: () => import_types.convertMcpCallToolResult,
  createSessionFsAdapter: () => import_types.createSessionFsAdapter,
  defineTool: () => import_types.defineTool
});
module.exports = __toCommonJS(index_exports);
var import_client = require("./client.js");
var import_session = require("./session.js");
var import_types = require("./types.js");
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CopilotClient,
  CopilotSession,
  SYSTEM_PROMPT_SECTIONS,
  approveAll,
  convertMcpCallToolResult,
  createSessionFsAdapter,
  defineTool
});

function createServerRpc(connection) {
  return {
    ping: async (params) => connection.sendRequest("ping", params),
    models: {
      list: async (params) => connection.sendRequest("models.list", params)
    },
    tools: {
      list: async (params) => connection.sendRequest("tools.list", params)
    },
    account: {
      getQuota: async (params) => connection.sendRequest("account.getQuota", params)
    },
    mcp: {
      config: {
        list: async () => connection.sendRequest("mcp.config.list", {}),
        add: async (params) => connection.sendRequest("mcp.config.add", params),
        update: async (params) => connection.sendRequest("mcp.config.update", params),
        remove: async (params) => connection.sendRequest("mcp.config.remove", params),
        enable: async (params) => connection.sendRequest("mcp.config.enable", params),
        disable: async (params) => connection.sendRequest("mcp.config.disable", params)
      },
      discover: async (params) => connection.sendRequest("mcp.discover", params)
    },
    skills: {
      config: {
        setDisabledSkills: async (params) => connection.sendRequest("skills.config.setDisabledSkills", params)
      },
      discover: async (params) => connection.sendRequest("skills.discover", params)
    },
    sessionFs: {
      setProvider: async (params) => connection.sendRequest("sessionFs.setProvider", params)
    },
    /** @experimental */
    sessions: {
      fork: async (params) => connection.sendRequest("sessions.fork", params)
    }
  };
}
function createSessionRpc(connection, sessionId) {
  return {
    auth: {
      getStatus: async () => connection.sendRequest("session.auth.getStatus", { sessionId })
    },
    model: {
      getCurrent: async () => connection.sendRequest("session.model.getCurrent", { sessionId }),
      switchTo: async (params) => connection.sendRequest("session.model.switchTo", { sessionId, ...params })
    },
    mode: {
      get: async () => connection.sendRequest("session.mode.get", { sessionId }),
      set: async (params) => connection.sendRequest("session.mode.set", { sessionId, ...params })
    },
    name: {
      get: async () => connection.sendRequest("session.name.get", { sessionId }),
      set: async (params) => connection.sendRequest("session.name.set", { sessionId, ...params })
    },
    plan: {
      read: async () => connection.sendRequest("session.plan.read", { sessionId }),
      update: async (params) => connection.sendRequest("session.plan.update", { sessionId, ...params }),
      delete: async () => connection.sendRequest("session.plan.delete", { sessionId })
    },
    workspaces: {
      getWorkspace: async () => connection.sendRequest("session.workspaces.getWorkspace", { sessionId }),
      listFiles: async () => connection.sendRequest("session.workspaces.listFiles", { sessionId }),
      readFile: async (params) => connection.sendRequest("session.workspaces.readFile", { sessionId, ...params }),
      createFile: async (params) => connection.sendRequest("session.workspaces.createFile", { sessionId, ...params })
    },
    instructions: {
      getSources: async () => connection.sendRequest("session.instructions.getSources", { sessionId })
    },
    /** @experimental */
    fleet: {
      start: async (params) => connection.sendRequest("session.fleet.start", { sessionId, ...params })
    },
    /** @experimental */
    agent: {
      list: async () => connection.sendRequest("session.agent.list", { sessionId }),
      getCurrent: async () => connection.sendRequest("session.agent.getCurrent", { sessionId }),
      select: async (params) => connection.sendRequest("session.agent.select", { sessionId, ...params }),
      deselect: async () => connection.sendRequest("session.agent.deselect", { sessionId }),
      reload: async () => connection.sendRequest("session.agent.reload", { sessionId })
    },
    /** @experimental */
    skills: {
      list: async () => connection.sendRequest("session.skills.list", { sessionId }),
      enable: async (params) => connection.sendRequest("session.skills.enable", { sessionId, ...params }),
      disable: async (params) => connection.sendRequest("session.skills.disable", { sessionId, ...params }),
      reload: async () => connection.sendRequest("session.skills.reload", { sessionId })
    },
    /** @experimental */
    mcp: {
      list: async () => connection.sendRequest("session.mcp.list", { sessionId }),
      enable: async (params) => connection.sendRequest("session.mcp.enable", { sessionId, ...params }),
      disable: async (params) => connection.sendRequest("session.mcp.disable", { sessionId, ...params }),
      reload: async () => connection.sendRequest("session.mcp.reload", { sessionId }),
      /** @experimental */
      oauth: {
        login: async (params) => connection.sendRequest("session.mcp.oauth.login", { sessionId, ...params })
      }
    },
    /** @experimental */
    plugins: {
      list: async () => connection.sendRequest("session.plugins.list", { sessionId })
    },
    /** @experimental */
    extensions: {
      list: async () => connection.sendRequest("session.extensions.list", { sessionId }),
      enable: async (params) => connection.sendRequest("session.extensions.enable", { sessionId, ...params }),
      disable: async (params) => connection.sendRequest("session.extensions.disable", { sessionId, ...params }),
      reload: async () => connection.sendRequest("session.extensions.reload", { sessionId })
    },
    tools: {
      handlePendingToolCall: async (params) => connection.sendRequest("session.tools.handlePendingToolCall", { sessionId, ...params })
    },
    commands: {
      handlePendingCommand: async (params) => connection.sendRequest("session.commands.handlePendingCommand", { sessionId, ...params })
    },
    ui: {
      elicitation: async (params) => connection.sendRequest("session.ui.elicitation", { sessionId, ...params }),
      handlePendingElicitation: async (params) => connection.sendRequest("session.ui.handlePendingElicitation", { sessionId, ...params })
    },
    permissions: {
      handlePendingPermissionRequest: async (params) => connection.sendRequest("session.permissions.handlePendingPermissionRequest", { sessionId, ...params }),
      setApproveAll: async (params) => connection.sendRequest("session.permissions.setApproveAll", { sessionId, ...params }),
      resetSessionApprovals: async () => connection.sendRequest("session.permissions.resetSessionApprovals", { sessionId })
    },
    log: async (params) => connection.sendRequest("session.log", { sessionId, ...params }),
    shell: {
      exec: async (params) => connection.sendRequest("session.shell.exec", { sessionId, ...params }),
      kill: async (params) => connection.sendRequest("session.shell.kill", { sessionId, ...params })
    },
    /** @experimental */
    history: {
      compact: async () => connection.sendRequest("session.history.compact", { sessionId }),
      truncate: async (params) => connection.sendRequest("session.history.truncate", { sessionId, ...params })
    },
    /** @experimental */
    usage: {
      getMetrics: async () => connection.sendRequest("session.usage.getMetrics", { sessionId })
    }
  };
}
function registerClientSessionApiHandlers(connection, getHandlers) {
  connection.onRequest("sessionFs.readFile", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.readFile(params);
  });
  connection.onRequest("sessionFs.writeFile", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.writeFile(params);
  });
  connection.onRequest("sessionFs.appendFile", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.appendFile(params);
  });
  connection.onRequest("sessionFs.exists", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.exists(params);
  });
  connection.onRequest("sessionFs.stat", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.stat(params);
  });
  connection.onRequest("sessionFs.mkdir", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.mkdir(params);
  });
  connection.onRequest("sessionFs.readdir", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.readdir(params);
  });
  connection.onRequest("sessionFs.readdirWithTypes", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.readdirWithTypes(params);
  });
  connection.onRequest("sessionFs.rm", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.rm(params);
  });
  connection.onRequest("sessionFs.rename", async (params) => {
    const handler = getHandlers(params.sessionId).sessionFs;
    if (!handler) throw new Error(`No sessionFs handler registered for session: ${params.sessionId}`);
    return handler.rename(params);
  });
}
export {
  createServerRpc,
  createSessionRpc,
  registerClientSessionApiHandlers
};

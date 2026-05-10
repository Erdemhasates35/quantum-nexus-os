import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { Socket } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from "vscode-jsonrpc/node.js";
import { createServerRpc, registerClientSessionApiHandlers } from "./generated/rpc.js";
import { getSdkProtocolVersion } from "./sdkProtocolVersion.js";
import { CopilotSession, NO_RESULT_PERMISSION_V2_ERROR } from "./session.js";
import { createSessionFsAdapter } from "./sessionFsProvider.js";
import { getTraceContext } from "./telemetry.js";
import { defaultJoinSessionPermissionHandler } from "./types.js";
const MIN_PROTOCOL_VERSION = 2;
function isZodSchema(value) {
  return value != null && typeof value === "object" && "toJSONSchema" in value && typeof value.toJSONSchema === "function";
}
function toJsonSchema(parameters) {
  if (!parameters) return void 0;
  if (isZodSchema(parameters)) {
    return parameters.toJSONSchema();
  }
  return parameters;
}
function extractTransformCallbacks(systemMessage) {
  if (!systemMessage || systemMessage.mode !== "customize" || !systemMessage.sections) {
    return { wirePayload: systemMessage, transformCallbacks: void 0 };
  }
  const transformCallbacks = /* @__PURE__ */ new Map();
  const wireSections = {};
  for (const [sectionId, override] of Object.entries(systemMessage.sections)) {
    if (!override) continue;
    if (typeof override.action === "function") {
      transformCallbacks.set(sectionId, override.action);
      wireSections[sectionId] = { action: "transform" };
    } else {
      wireSections[sectionId] = { action: override.action, content: override.content };
    }
  }
  if (transformCallbacks.size === 0) {
    return { wirePayload: systemMessage, transformCallbacks: void 0 };
  }
  const wirePayload = {
    ...systemMessage,
    sections: wireSections
  };
  return { wirePayload, transformCallbacks };
}
function getNodeExecPath() {
  if (process.versions.bun) {
    return "node";
  }
  return process.execPath;
}
function getBundledCliPath() {
  if (typeof import.meta.resolve === "function") {
    const sdkUrl = import.meta.resolve("@github/copilot/sdk");
    const sdkPath = fileURLToPath(sdkUrl);
    return join(dirname(dirname(sdkPath)), "index.js");
  }
  const req = createRequire(__filename);
  const searchPaths = req.resolve.paths("@github/copilot") ?? [];
  for (const base of searchPaths) {
    const candidate = join(base, "@github", "copilot", "index.js");
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `Could not find @github/copilot package. Searched ${searchPaths.length} paths. Ensure it is installed, or pass cliPath/cliUrl to CopilotClient.`
  );
}
class CopilotClient {
  cliStartTimeout = null;
  cliProcess = null;
  connection = null;
  socket = null;
  actualPort = null;
  actualHost = "localhost";
  state = "disconnected";
  sessions = /* @__PURE__ */ new Map();
  stderrBuffer = "";
  // Captures CLI stderr for error messages
  options;
  isExternalServer = false;
  forceStopping = false;
  onListModels;
  onGetTraceContext;
  modelsCache = null;
  modelsCacheLock = Promise.resolve();
  sessionLifecycleHandlers = /* @__PURE__ */ new Set();
  typedLifecycleHandlers = /* @__PURE__ */ new Map();
  _rpc = null;
  processExitPromise = null;
  // Rejects when CLI process exits
  negotiatedProtocolVersion = null;
  /** Connection-level session filesystem config, set via constructor option. */
  sessionFsConfig = null;
  /**
   * Typed server-scoped RPC methods.
   * @throws Error if the client is not connected
   */
  get rpc() {
    if (!this.connection) {
      throw new Error("Client is not connected. Call start() first.");
    }
    if (!this._rpc) {
      this._rpc = createServerRpc(this.connection);
    }
    return this._rpc;
  }
  /**
   * Creates a new CopilotClient instance.
   *
   * @param options - Configuration options for the client
   * @throws Error if mutually exclusive options are provided (e.g., cliUrl with useStdio or cliPath)
   *
   * @example
   * ```typescript
   * // Default options - spawns CLI server using stdio
   * const client = new CopilotClient();
   *
   * // Connect to an existing server
   * const client = new CopilotClient({ cliUrl: "localhost:3000" });
   *
   * // Custom CLI path with specific log level
   * const client = new CopilotClient({
   *   cliPath: "/usr/local/bin/copilot",
   *   logLevel: "debug"
   * });
   * ```
   */
  constructor(options = {}) {
    if (options.cliUrl && (options.useStdio === true || options.cliPath)) {
      throw new Error("cliUrl is mutually exclusive with useStdio and cliPath");
    }
    if (options.isChildProcess && (options.cliUrl || options.useStdio === false)) {
      throw new Error(
        "isChildProcess must be used in conjunction with useStdio and not with cliUrl"
      );
    }
    if (options.cliUrl && (options.gitHubToken || options.useLoggedInUser !== void 0)) {
      throw new Error(
        "gitHubToken and useLoggedInUser cannot be used with cliUrl (external server manages its own auth)"
      );
    }
    if (options.sessionFs) {
      this.validateSessionFsConfig(options.sessionFs);
    }
    if (options.cliUrl) {
      const { host, port } = this.parseCliUrl(options.cliUrl);
      this.actualHost = host;
      this.actualPort = port;
      this.isExternalServer = true;
    }
    if (options.isChildProcess) {
      this.isExternalServer = true;
    }
    this.onListModels = options.onListModels;
    this.onGetTraceContext = options.onGetTraceContext;
    this.sessionFsConfig = options.sessionFs ?? null;
    const effectiveEnv = options.env ?? process.env;
    this.options = {
      cliPath: options.cliUrl ? void 0 : options.cliPath || effectiveEnv.COPILOT_CLI_PATH || getBundledCliPath(),
      cliArgs: options.cliArgs ?? [],
      cwd: options.cwd ?? process.cwd(),
      port: options.port || 0,
      useStdio: options.cliUrl ? false : options.useStdio ?? true,
      // Default to stdio unless cliUrl is provided
      isChildProcess: options.isChildProcess ?? false,
      cliUrl: options.cliUrl,
      logLevel: options.logLevel || "debug",
      autoStart: options.autoStart ?? true,
      autoRestart: false,
      env: effectiveEnv,
      gitHubToken: options.gitHubToken,
      // Default useLoggedInUser to false when gitHubToken is provided, otherwise true
      useLoggedInUser: options.useLoggedInUser ?? (options.gitHubToken ? false : true),
      telemetry: options.telemetry,
      sessionIdleTimeoutSeconds: options.sessionIdleTimeoutSeconds ?? 0
    };
  }
  /**
   * Parse CLI URL into host and port
   * Supports formats: "host:port", "http://host:port", "https://host:port", or just "port"
   */
  parseCliUrl(url) {
    let cleanUrl = url.replace(/^https?:\/\//, "");
    if (/^\d+$/.test(cleanUrl)) {
      return { host: "localhost", port: parseInt(cleanUrl, 10) };
    }
    const parts = cleanUrl.split(":");
    if (parts.length !== 2) {
      throw new Error(
        `Invalid cliUrl format: ${url}. Expected "host:port", "http://host:port", or "port"`
      );
    }
    const host = parts[0] || "localhost";
    const port = parseInt(parts[1], 10);
    if (isNaN(port) || port <= 0 || port > 65535) {
      throw new Error(`Invalid port in cliUrl: ${url}`);
    }
    return { host, port };
  }
  validateSessionFsConfig(config) {
    if (!config.initialCwd) {
      throw new Error("sessionFs.initialCwd is required");
    }
    if (!config.sessionStatePath) {
      throw new Error("sessionFs.sessionStatePath is required");
    }
    if (config.conventions !== "windows" && config.conventions !== "posix") {
      throw new Error("sessionFs.conventions must be either 'windows' or 'posix'");
    }
  }
  /**
   * Starts the CLI server and establishes a connection.
   *
   * If connecting to an external server (via cliUrl), only establishes the connection.
   * Otherwise, spawns the CLI server process and then connects.
   *
   * This method is called automatically when creating a session if `autoStart` is true (default).
   *
   * @returns A promise that resolves when the connection is established
   * @throws Error if the server fails to start or the connection fails
   *
   * @example
   * ```typescript
   * const client = new CopilotClient({ autoStart: false });
   * await client.start();
   * // Now ready to create sessions
   * ```
   */
  async start() {
    if (this.state === "connected") {
      return;
    }
    this.state = "connecting";
    try {
      if (!this.isExternalServer) {
        await this.startCLIServer();
      }
      await this.connectToServer();
      await this.verifyProtocolVersion();
      if (this.sessionFsConfig) {
        await this.connection.sendRequest("sessionFs.setProvider", {
          initialCwd: this.sessionFsConfig.initialCwd,
          sessionStatePath: this.sessionFsConfig.sessionStatePath,
          conventions: this.sessionFsConfig.conventions
        });
      }
      this.state = "connected";
    } catch (error) {
      this.state = "error";
      throw error;
    }
  }
  /**
   * Stops the CLI server and closes all active sessions.
   *
   * This method performs graceful cleanup:
   * 1. Closes all active sessions (releases in-memory resources)
   * 2. Closes the JSON-RPC connection
   * 3. Terminates the CLI server process (if spawned by this client)
   *
   * Note: session data on disk is preserved, so sessions can be resumed later.
   * To permanently remove session data before stopping, call
   * {@link deleteSession} for each session first.
   *
   * @returns A promise that resolves with an array of errors encountered during cleanup.
   *          An empty array indicates all cleanup succeeded.
   *
   * @example
   * ```typescript
   * const errors = await client.stop();
   * if (errors.length > 0) {
   *   console.error("Cleanup errors:", errors);
   * }
   * ```
   */
  async stop() {
    const errors = [];
    for (const session of this.sessions.values()) {
      const sessionId = session.sessionId;
      let lastError = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await session.disconnect();
          lastError = null;
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < 3) {
            const delay = 100 * Math.pow(2, attempt - 1);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      if (lastError) {
        errors.push(
          new Error(
            `Failed to disconnect session ${sessionId} after 3 attempts: ${lastError.message}`
          )
        );
      }
    }
    this.sessions.clear();
    if (this.connection) {
      try {
        this.connection.dispose();
      } catch (error) {
        errors.push(
          new Error(
            `Failed to dispose connection: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
      this.connection = null;
      this._rpc = null;
    }
    this.modelsCache = null;
    if (this.socket) {
      try {
        this.socket.end();
      } catch (error) {
        errors.push(
          new Error(
            `Failed to close socket: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
      this.socket = null;
    }
    if (this.cliProcess && !this.isExternalServer) {
      try {
        this.cliProcess.kill();
      } catch (error) {
        errors.push(
          new Error(
            `Failed to kill CLI process: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      }
      this.cliProcess = null;
    }
    if (this.cliStartTimeout) {
      clearTimeout(this.cliStartTimeout);
      this.cliStartTimeout = null;
    }
    this.state = "disconnected";
    this.actualPort = null;
    this.stderrBuffer = "";
    this.processExitPromise = null;
    return errors;
  }
  /**
   * Forcefully stops the CLI server without graceful cleanup.
   *
   * Use this when {@link stop} fails or takes too long. This method:
   * - Clears all sessions immediately without destroying them
   * - Force closes the connection
   * - Sends SIGKILL to the CLI process (if spawned by this client)
   *
   * @returns A promise that resolves when the force stop is complete
   *
   * @example
   * ```typescript
   * // If normal stop hangs, force stop
   * const stopPromise = client.stop();
   * const timeout = new Promise((_, reject) =>
   *   setTimeout(() => reject(new Error("Timeout")), 5000)
   * );
   *
   * try {
   *   await Promise.race([stopPromise, timeout]);
   * } catch {
   *   await client.forceStop();
   * }
   * ```
   */
  async forceStop() {
    this.forceStopping = true;
    this.sessions.clear();
    if (this.connection) {
      try {
        this.connection.dispose();
      } catch {
      }
      this.connection = null;
      this._rpc = null;
    }
    this.modelsCache = null;
    if (this.socket) {
      try {
        this.socket.destroy();
      } catch {
      }
      this.socket = null;
    }
    if (this.cliProcess && !this.isExternalServer) {
      try {
        this.cliProcess.kill("SIGKILL");
      } catch {
      }
      this.cliProcess = null;
    }
    if (this.cliStartTimeout) {
      clearTimeout(this.cliStartTimeout);
      this.cliStartTimeout = null;
    }
    this.state = "disconnected";
    this.actualPort = null;
    this.stderrBuffer = "";
    this.processExitPromise = null;
  }
  /**
   * Creates a new conversation session with the Copilot CLI.
   *
   * Sessions maintain conversation state, handle events, and manage tool execution.
   * If the client is not connected and `autoStart` is enabled, this will automatically
   * start the connection.
   *
   * @param config - Optional configuration for the session
   * @returns A promise that resolves with the created session
   * @throws Error if the client is not connected and autoStart is disabled
   *
   * @example
   * ```typescript
   * // Basic session
   * const session = await client.createSession({ onPermissionRequest: approveAll });
   *
   * // Session with model and tools
   * const session = await client.createSession({
   *   onPermissionRequest: approveAll,
   *   model: "gpt-4",
   *   tools: [{
   *     name: "get_weather",
   *     description: "Get weather for a location",
   *     parameters: { type: "object", properties: { location: { type: "string" } } },
   *     handler: async (args) => ({ temperature: 72 })
   *   }]
   * });
   * ```
   */
  async createSession(config) {
    if (!config?.onPermissionRequest) {
      throw new Error(
        "An onPermissionRequest handler is required when creating a session. For example, to allow all permissions, use { onPermissionRequest: approveAll }."
      );
    }
    if (!this.connection) {
      if (this.options.autoStart) {
        await this.start();
      } else {
        throw new Error("Client not connected. Call start() first.");
      }
    }
    const sessionId = config.sessionId ?? randomUUID();
    const session = new CopilotSession(
      sessionId,
      this.connection,
      void 0,
      this.onGetTraceContext
    );
    session.registerTools(config.tools);
    session.registerCommands(config.commands);
    session.registerPermissionHandler(config.onPermissionRequest);
    if (config.onUserInputRequest) {
      session.registerUserInputHandler(config.onUserInputRequest);
    }
    if (config.onElicitationRequest) {
      session.registerElicitationHandler(config.onElicitationRequest);
    }
    if (config.hooks) {
      session.registerHooks(config.hooks);
    }
    const { wirePayload: wireSystemMessage, transformCallbacks } = extractTransformCallbacks(
      config.systemMessage
    );
    if (transformCallbacks) {
      session.registerTransformCallbacks(transformCallbacks);
    }
    if (config.onEvent) {
      session.on(config.onEvent);
    }
    this.sessions.set(sessionId, session);
    if (this.sessionFsConfig) {
      if (config.createSessionFsHandler) {
        session.clientSessionApis.sessionFs = createSessionFsAdapter(
          config.createSessionFsHandler(session)
        );
      } else {
        throw new Error(
          "createSessionFsHandler is required in session config when sessionFs is enabled in client options."
        );
      }
    }
    try {
      const response = await this.connection.sendRequest("session.create", {
        ...await getTraceContext(this.onGetTraceContext),
        model: config.model,
        sessionId,
        clientName: config.clientName,
        reasoningEffort: config.reasoningEffort,
        tools: config.tools?.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: toJsonSchema(tool.parameters),
          overridesBuiltInTool: tool.overridesBuiltInTool,
          skipPermission: tool.skipPermission
        })),
        commands: config.commands?.map((cmd) => ({
          name: cmd.name,
          description: cmd.description
        })),
        systemMessage: wireSystemMessage,
        availableTools: config.availableTools,
        excludedTools: config.excludedTools,
        provider: config.provider,
        modelCapabilities: config.modelCapabilities,
        requestPermission: true,
        requestUserInput: !!config.onUserInputRequest,
        requestElicitation: !!config.onElicitationRequest,
        hooks: !!(config.hooks && Object.values(config.hooks).some(Boolean)),
        workingDirectory: config.workingDirectory,
        streaming: config.streaming,
        includeSubAgentStreamingEvents: config.includeSubAgentStreamingEvents ?? true,
        mcpServers: config.mcpServers,
        envValueMode: "direct",
        customAgents: config.customAgents,
        defaultAgent: config.defaultAgent,
        agent: config.agent,
        configDir: config.configDir,
        enableConfigDiscovery: config.enableConfigDiscovery,
        skillDirectories: config.skillDirectories,
        disabledSkills: config.disabledSkills,
        infiniteSessions: config.infiniteSessions,
        gitHubToken: config.gitHubToken
      });
      const { workspacePath, capabilities } = response;
      session["_workspacePath"] = workspacePath;
      session.setCapabilities(capabilities);
    } catch (e) {
      this.sessions.delete(sessionId);
      throw e;
    }
    return session;
  }
  /**
   * Resumes an existing conversation session by its ID.
   *
   * This allows you to continue a previous conversation, maintaining all
   * conversation history. The session must have been previously created
   * and not deleted.
   *
   * @param sessionId - The ID of the session to resume
   * @param config - Optional configuration for the resumed session
   * @returns A promise that resolves with the resumed session
   * @throws Error if the session does not exist or the client is not connected
   *
   * @example
   * ```typescript
   * // Resume a previous session
   * const session = await client.resumeSession("session-123", { onPermissionRequest: approveAll });
   *
   * // Resume with new tools
   * const session = await client.resumeSession("session-123", {
   *   onPermissionRequest: approveAll,
   *   tools: [myNewTool]
   * });
   * ```
   */
  async resumeSession(sessionId, config) {
    if (!config?.onPermissionRequest) {
      throw new Error(
        "An onPermissionRequest handler is required when resuming a session. For example, to allow all permissions, use { onPermissionRequest: approveAll }."
      );
    }
    if (!this.connection) {
      if (this.options.autoStart) {
        await this.start();
      } else {
        throw new Error("Client not connected. Call start() first.");
      }
    }
    const session = new CopilotSession(
      sessionId,
      this.connection,
      void 0,
      this.onGetTraceContext
    );
    session.registerTools(config.tools);
    session.registerCommands(config.commands);
    session.registerPermissionHandler(config.onPermissionRequest);
    if (config.onUserInputRequest) {
      session.registerUserInputHandler(config.onUserInputRequest);
    }
    if (config.onElicitationRequest) {
      session.registerElicitationHandler(config.onElicitationRequest);
    }
    if (config.hooks) {
      session.registerHooks(config.hooks);
    }
    const { wirePayload: wireSystemMessage, transformCallbacks } = extractTransformCallbacks(
      config.systemMessage
    );
    if (transformCallbacks) {
      session.registerTransformCallbacks(transformCallbacks);
    }
    if (config.onEvent) {
      session.on(config.onEvent);
    }
    this.sessions.set(sessionId, session);
    if (this.sessionFsConfig) {
      if (config.createSessionFsHandler) {
        session.clientSessionApis.sessionFs = createSessionFsAdapter(
          config.createSessionFsHandler(session)
        );
      } else {
        throw new Error(
          "createSessionFsHandler is required in session config when sessionFs is enabled in client options."
        );
      }
    }
    try {
      const response = await this.connection.sendRequest("session.resume", {
        ...await getTraceContext(this.onGetTraceContext),
        sessionId,
        clientName: config.clientName,
        model: config.model,
        reasoningEffort: config.reasoningEffort,
        systemMessage: wireSystemMessage,
        availableTools: config.availableTools,
        excludedTools: config.excludedTools,
        tools: config.tools?.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: toJsonSchema(tool.parameters),
          overridesBuiltInTool: tool.overridesBuiltInTool,
          skipPermission: tool.skipPermission
        })),
        commands: config.commands?.map((cmd) => ({
          name: cmd.name,
          description: cmd.description
        })),
        provider: config.provider,
        modelCapabilities: config.modelCapabilities,
        requestPermission: config.onPermissionRequest !== defaultJoinSessionPermissionHandler,
        requestUserInput: !!config.onUserInputRequest,
        requestElicitation: !!config.onElicitationRequest,
        hooks: !!(config.hooks && Object.values(config.hooks).some(Boolean)),
        workingDirectory: config.workingDirectory,
        configDir: config.configDir,
        enableConfigDiscovery: config.enableConfigDiscovery,
        streaming: config.streaming,
        includeSubAgentStreamingEvents: config.includeSubAgentStreamingEvents ?? true,
        mcpServers: config.mcpServers,
        envValueMode: "direct",
        customAgents: config.customAgents,
        defaultAgent: config.defaultAgent,
        agent: config.agent,
        skillDirectories: config.skillDirectories,
        disabledSkills: config.disabledSkills,
        infiniteSessions: config.infiniteSessions,
        disableResume: config.disableResume,
        gitHubToken: config.gitHubToken
      });
      const { workspacePath, capabilities } = response;
      session["_workspacePath"] = workspacePath;
      session.setCapabilities(capabilities);
    } catch (e) {
      this.sessions.delete(sessionId);
      throw e;
    }
    return session;
  }
  /**
   * Gets the current connection state of the client.
   *
   * @returns The current connection state: "disconnected", "connecting", "connected", or "error"
   *
   * @example
   * ```typescript
   * if (client.getState() === "connected") {
   *   const session = await client.createSession({ onPermissionRequest: approveAll });
   * }
   * ```
   */
  getState() {
    return this.state;
  }
  /**
   * Sends a ping request to the server to verify connectivity.
   *
   * @param message - Optional message to include in the ping
   * @returns A promise that resolves with the ping response containing the message and timestamp
   * @throws Error if the client is not connected
   *
   * @example
   * ```typescript
   * const response = await client.ping("health check");
   * console.log(`Server responded at ${new Date(response.timestamp)}`);
   * ```
   */
  async ping(message) {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const result = await this.connection.sendRequest("ping", { message });
    return result;
  }
  /**
   * Get CLI status including version and protocol information
   */
  async getStatus() {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const result = await this.connection.sendRequest("status.get", {});
    return result;
  }
  /**
   * Get current authentication status
   */
  async getAuthStatus() {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const result = await this.connection.sendRequest("auth.getStatus", {});
    return result;
  }
  /**
   * List available models with their metadata.
   *
   * If an `onListModels` handler was provided in the client options,
   * it is called instead of querying the CLI server.
   *
   * Results are cached after the first successful call to avoid rate limiting.
   * The cache is cleared when the client disconnects.
   *
   * @throws Error if not connected (when no custom handler is set)
   */
  async listModels() {
    await this.modelsCacheLock;
    let resolveLock;
    this.modelsCacheLock = new Promise((resolve) => {
      resolveLock = resolve;
    });
    try {
      if (this.modelsCache !== null) {
        return [...this.modelsCache];
      }
      let models;
      if (this.onListModels) {
        models = await this.onListModels();
      } else {
        if (!this.connection) {
          throw new Error("Client not connected");
        }
        const result = await this.connection.sendRequest("models.list", {});
        const response = result;
        models = response.models;
        for (const model of models) {
          const m = model;
          if (!m.capabilities) {
            m.capabilities = {
              supports: {},
              limits: { max_context_window_tokens: 0 }
            };
          } else {
            if (!m.capabilities.supports) m.capabilities.supports = {};
            if (!m.capabilities.limits) {
              m.capabilities.limits = { max_context_window_tokens: 0 };
            } else if (m.capabilities.limits.max_context_window_tokens === void 0) {
              m.capabilities.limits.max_context_window_tokens = 0;
            }
          }
        }
      }
      this.modelsCache = [...models];
      return [...models];
    } finally {
      resolveLock();
    }
  }
  /**
   * Verify that the server's protocol version is within the supported range
   * and store the negotiated version.
   */
  async verifyProtocolVersion() {
    const maxVersion = getSdkProtocolVersion();
    let pingResult;
    if (this.processExitPromise) {
      pingResult = await Promise.race([this.ping(), this.processExitPromise]);
    } else {
      pingResult = await this.ping();
    }
    const serverVersion = pingResult.protocolVersion;
    if (serverVersion === void 0) {
      throw new Error(
        `SDK protocol version mismatch: SDK supports versions ${MIN_PROTOCOL_VERSION}-${maxVersion}, but server does not report a protocol version. Please update your server to ensure compatibility.`
      );
    }
    if (serverVersion < MIN_PROTOCOL_VERSION || serverVersion > maxVersion) {
      throw new Error(
        `SDK protocol version mismatch: SDK supports versions ${MIN_PROTOCOL_VERSION}-${maxVersion}, but server reports version ${serverVersion}. Please update your SDK or server to ensure compatibility.`
      );
    }
    this.negotiatedProtocolVersion = serverVersion;
  }
  /**
   * Gets the ID of the most recently updated session.
   *
   * This is useful for resuming the last conversation when the session ID
   * was not stored.
   *
   * @returns A promise that resolves with the session ID, or undefined if no sessions exist
   * @throws Error if the client is not connected
   *
   * @example
   * ```typescript
   * const lastId = await client.getLastSessionId();
   * if (lastId) {
   *   const session = await client.resumeSession(lastId, { onPermissionRequest: approveAll });
   * }
   * ```
   */
  async getLastSessionId() {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const response = await this.connection.sendRequest("session.getLastId", {});
    return response.sessionId;
  }
  /**
   * Permanently deletes a session and all its data from disk, including
   * conversation history, planning state, and artifacts.
   *
   * Unlike {@link CopilotSession.disconnect}, which only releases in-memory
   * resources and preserves session data for later resumption, this method
   * is irreversible. The session cannot be resumed after deletion.
   *
   * @param sessionId - The ID of the session to delete
   * @returns A promise that resolves when the session is deleted
   * @throws Error if the session does not exist or deletion fails
   *
   * @example
   * ```typescript
   * await client.deleteSession("session-123");
   * ```
   */
  async deleteSession(sessionId) {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const response = await this.connection.sendRequest("session.delete", {
      sessionId
    });
    const { success, error } = response;
    if (!success) {
      throw new Error(`Failed to delete session ${sessionId}: ${error || "Unknown error"}`);
    }
    this.sessions.delete(sessionId);
  }
  /**
   * List all available sessions.
   *
   * @param filter - Optional filter to limit returned sessions by context fields
   *
   * @example
   * // List all sessions
   * const sessions = await client.listSessions();
   *
   * @example
   * // List sessions for a specific repository
   * const sessions = await client.listSessions({ repository: "owner/repo" });
   */
  async listSessions(filter) {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const response = await this.connection.sendRequest("session.list", {
      filter
    });
    const { sessions } = response;
    return sessions.map(CopilotClient.toSessionMetadata);
  }
  /**
   * Gets metadata for a specific session by ID.
   *
   * This provides an efficient O(1) lookup of a single session's metadata
   * instead of listing all sessions. Returns undefined if the session is not found.
   *
   * @param sessionId - The ID of the session to look up
   * @returns A promise that resolves with the session metadata, or undefined if not found
   * @throws Error if the client is not connected
   *
   * @example
   * ```typescript
   * const metadata = await client.getSessionMetadata("session-123");
   * if (metadata) {
   *   console.log(`Session started at: ${metadata.startTime}`);
   * }
   * ```
   */
  async getSessionMetadata(sessionId) {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const response = await this.connection.sendRequest("session.getMetadata", { sessionId });
    const { session } = response;
    if (!session) {
      return void 0;
    }
    return CopilotClient.toSessionMetadata(session);
  }
  static toSessionMetadata(raw) {
    return {
      sessionId: raw.sessionId,
      startTime: new Date(raw.startTime),
      modifiedTime: new Date(raw.modifiedTime),
      summary: raw.summary,
      isRemote: raw.isRemote,
      context: raw.context
    };
  }
  /**
   * Gets the foreground session ID in TUI+server mode.
   *
   * This returns the ID of the session currently displayed in the TUI.
   * Only available when connecting to a server running in TUI+server mode (--ui-server).
   *
   * @returns A promise that resolves with the foreground session ID, or undefined if none
   * @throws Error if the client is not connected
   *
   * @example
   * ```typescript
   * const sessionId = await client.getForegroundSessionId();
   * if (sessionId) {
   *   console.log(`TUI is displaying session: ${sessionId}`);
   * }
   * ```
   */
  async getForegroundSessionId() {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const response = await this.connection.sendRequest("session.getForeground", {});
    return response.sessionId;
  }
  /**
   * Sets the foreground session in TUI+server mode.
   *
   * This requests the TUI to switch to displaying the specified session.
   * Only available when connecting to a server running in TUI+server mode (--ui-server).
   *
   * @param sessionId - The ID of the session to display in the TUI
   * @returns A promise that resolves when the session is switched
   * @throws Error if the client is not connected or if the operation fails
   *
   * @example
   * ```typescript
   * // Switch the TUI to display a specific session
   * await client.setForegroundSessionId("session-123");
   * ```
   */
  async setForegroundSessionId(sessionId) {
    if (!this.connection) {
      throw new Error("Client not connected");
    }
    const response = await this.connection.sendRequest("session.setForeground", { sessionId });
    const result = response;
    if (!result.success) {
      throw new Error(result.error || "Failed to set foreground session");
    }
  }
  on(eventTypeOrHandler, handler) {
    if (typeof eventTypeOrHandler === "string" && handler) {
      const eventType = eventTypeOrHandler;
      if (!this.typedLifecycleHandlers.has(eventType)) {
        this.typedLifecycleHandlers.set(eventType, /* @__PURE__ */ new Set());
      }
      const storedHandler = handler;
      this.typedLifecycleHandlers.get(eventType).add(storedHandler);
      return () => {
        const handlers = this.typedLifecycleHandlers.get(eventType);
        if (handlers) {
          handlers.delete(storedHandler);
        }
      };
    }
    const wildcardHandler = eventTypeOrHandler;
    this.sessionLifecycleHandlers.add(wildcardHandler);
    return () => {
      this.sessionLifecycleHandlers.delete(wildcardHandler);
    };
  }
  /**
   * Start the CLI server process
   */
  async startCLIServer() {
    return new Promise((resolve, reject) => {
      this.stderrBuffer = "";
      const args = [
        ...this.options.cliArgs,
        "--headless",
        "--no-auto-update",
        "--log-level",
        this.options.logLevel
      ];
      if (this.options.useStdio) {
        args.push("--stdio");
      } else if (this.options.port > 0) {
        args.push("--port", this.options.port.toString());
      }
      if (this.options.gitHubToken) {
        args.push("--auth-token-env", "COPILOT_SDK_AUTH_TOKEN");
      }
      if (!this.options.useLoggedInUser) {
        args.push("--no-auto-login");
      }
      if (this.options.sessionIdleTimeoutSeconds !== void 0 && this.options.sessionIdleTimeoutSeconds > 0) {
        args.push(
          "--session-idle-timeout",
          this.options.sessionIdleTimeoutSeconds.toString()
        );
      }
      const envWithoutNodeDebug = { ...this.options.env };
      delete envWithoutNodeDebug.NODE_DEBUG;
      if (this.options.gitHubToken) {
        envWithoutNodeDebug.COPILOT_SDK_AUTH_TOKEN = this.options.gitHubToken;
      }
      if (!this.options.cliPath) {
        throw new Error(
          "Path to Copilot CLI is required. Please provide it via the cliPath option, or use cliUrl to rely on a remote CLI."
        );
      }
      if (this.options.telemetry) {
        const t = this.options.telemetry;
        envWithoutNodeDebug.COPILOT_OTEL_ENABLED = "true";
        if (t.otlpEndpoint !== void 0)
          envWithoutNodeDebug.OTEL_EXPORTER_OTLP_ENDPOINT = t.otlpEndpoint;
        if (t.filePath !== void 0)
          envWithoutNodeDebug.COPILOT_OTEL_FILE_EXPORTER_PATH = t.filePath;
        if (t.exporterType !== void 0)
          envWithoutNodeDebug.COPILOT_OTEL_EXPORTER_TYPE = t.exporterType;
        if (t.sourceName !== void 0)
          envWithoutNodeDebug.COPILOT_OTEL_SOURCE_NAME = t.sourceName;
        if (t.captureContent !== void 0)
          envWithoutNodeDebug.OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = String(
            t.captureContent
          );
      }
      if (!existsSync(this.options.cliPath)) {
        throw new Error(
          `Copilot CLI not found at ${this.options.cliPath}. Ensure @github/copilot is installed.`
        );
      }
      const stdioConfig = this.options.useStdio ? ["pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"];
      const isJsFile = this.options.cliPath.endsWith(".js");
      if (isJsFile) {
        this.cliProcess = spawn(getNodeExecPath(), [this.options.cliPath, ...args], {
          stdio: stdioConfig,
          cwd: this.options.cwd,
          env: envWithoutNodeDebug,
          windowsHide: true
        });
      } else {
        this.cliProcess = spawn(this.options.cliPath, args, {
          stdio: stdioConfig,
          cwd: this.options.cwd,
          env: envWithoutNodeDebug,
          windowsHide: true
        });
      }
      let stdout = "";
      let resolved = false;
      if (this.options.useStdio) {
        resolved = true;
        resolve();
      } else {
        this.cliProcess.stdout?.on("data", (data) => {
          stdout += data.toString();
          const match = stdout.match(/listening on port (\d+)/i);
          if (match && !resolved) {
            this.actualPort = parseInt(match[1], 10);
            resolved = true;
            resolve();
          }
        });
      }
      this.cliProcess.stderr?.on("data", (data) => {
        this.stderrBuffer += data.toString();
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            process.stderr.write(`[CLI subprocess] ${line}
`);
          }
        }
      });
      this.cliProcess.on("error", (error) => {
        if (!resolved) {
          resolved = true;
          const stderrOutput = this.stderrBuffer.trim();
          if (stderrOutput) {
            reject(
              new Error(
                `Failed to start CLI server: ${error.message}
stderr: ${stderrOutput}`
              )
            );
          } else {
            reject(new Error(`Failed to start CLI server: ${error.message}`));
          }
        }
      });
      this.processExitPromise = new Promise((_, rejectProcessExit) => {
        this.cliProcess.on("exit", (code) => {
          setTimeout(() => {
            const stderrOutput = this.stderrBuffer.trim();
            if (stderrOutput) {
              rejectProcessExit(
                new Error(
                  `CLI server exited with code ${code}
stderr: ${stderrOutput}`
                )
              );
            } else {
              rejectProcessExit(
                new Error(`CLI server exited unexpectedly with code ${code}`)
              );
            }
          }, 50);
        });
      });
      this.processExitPromise.catch(() => {
      });
      this.cliProcess.on("exit", (code) => {
        if (!resolved) {
          resolved = true;
          const stderrOutput = this.stderrBuffer.trim();
          if (stderrOutput) {
            reject(
              new Error(
                `CLI server exited with code ${code}
stderr: ${stderrOutput}`
              )
            );
          } else {
            reject(new Error(`CLI server exited with code ${code}`));
          }
        }
      });
      this.cliStartTimeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Timeout waiting for CLI server to start"));
        }
      }, 1e4);
    });
  }
  /**
   * Connect to the CLI server (via socket or stdio)
   */
  async connectToServer() {
    if (this.options.isChildProcess) {
      return this.connectToParentProcessViaStdio();
    } else if (this.options.useStdio) {
      return this.connectToChildProcessViaStdio();
    } else {
      return this.connectViaTcp();
    }
  }
  /**
   * Connect to child via stdio pipes
   */
  async connectToChildProcessViaStdio() {
    if (!this.cliProcess) {
      throw new Error("CLI process not started");
    }
    this.cliProcess.stdin?.on("error", (err) => {
      if (!this.forceStopping) {
        throw err;
      }
    });
    this.connection = createMessageConnection(
      new StreamMessageReader(this.cliProcess.stdout),
      new StreamMessageWriter(this.cliProcess.stdin)
    );
    this.attachConnectionHandlers();
    this.connection.listen();
  }
  /**
   * Connect to parent via stdio pipes
   */
  async connectToParentProcessViaStdio() {
    if (this.cliProcess) {
      throw new Error("CLI child process was unexpectedly started in parent process mode");
    }
    this.connection = createMessageConnection(
      new StreamMessageReader(process.stdin),
      new StreamMessageWriter(process.stdout)
    );
    this.attachConnectionHandlers();
    this.connection.listen();
  }
  /**
   * Connect to the CLI server via TCP socket
   */
  async connectViaTcp() {
    if (!this.actualPort) {
      throw new Error("Server port not available");
    }
    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      this.socket.connect(this.actualPort, this.actualHost, () => {
        this.connection = createMessageConnection(
          new StreamMessageReader(this.socket),
          new StreamMessageWriter(this.socket)
        );
        this.attachConnectionHandlers();
        this.connection.listen();
        resolve();
      });
      this.socket.on("error", (error) => {
        reject(new Error(`Failed to connect to CLI server: ${error.message}`));
      });
    });
  }
  attachConnectionHandlers() {
    if (!this.connection) {
      return;
    }
    this.connection.onNotification("session.event", (notification) => {
      this.handleSessionEventNotification(notification);
    });
    this.connection.onNotification("session.lifecycle", (notification) => {
      this.handleSessionLifecycleNotification(notification);
    });
    this.connection.onRequest(
      "tool.call",
      async (params) => await this.handleToolCallRequestV2(params)
    );
    this.connection.onRequest(
      "permission.request",
      async (params) => await this.handlePermissionRequestV2(params)
    );
    this.connection.onRequest(
      "userInput.request",
      async (params) => await this.handleUserInputRequest(params)
    );
    this.connection.onRequest(
      "hooks.invoke",
      async (params) => await this.handleHooksInvoke(params)
    );
    this.connection.onRequest(
      "systemMessage.transform",
      async (params) => await this.handleSystemMessageTransform(params)
    );
    const sessions = this.sessions;
    registerClientSessionApiHandlers(this.connection, (sessionId) => {
      const session = sessions.get(sessionId);
      if (!session) throw new Error(`No session found for sessionId: ${sessionId}`);
      return session.clientSessionApis;
    });
    this.connection.onClose(() => {
      this.state = "disconnected";
    });
    this.connection.onError((_error) => {
      this.state = "disconnected";
    });
  }
  handleSessionEventNotification(notification) {
    if (typeof notification !== "object" || !notification || !("sessionId" in notification) || typeof notification.sessionId !== "string" || !("event" in notification)) {
      return;
    }
    const session = this.sessions.get(notification.sessionId);
    if (session) {
      session._dispatchEvent(notification.event);
    }
  }
  handleSessionLifecycleNotification(notification) {
    if (typeof notification !== "object" || !notification || !("type" in notification) || typeof notification.type !== "string" || !("sessionId" in notification) || typeof notification.sessionId !== "string") {
      return;
    }
    const event = notification;
    const typedHandlers = this.typedLifecycleHandlers.get(event.type);
    if (typedHandlers) {
      for (const handler of typedHandlers) {
        try {
          handler(event);
        } catch {
        }
      }
    }
    for (const handler of this.sessionLifecycleHandlers) {
      try {
        handler(event);
      } catch {
      }
    }
  }
  async handleUserInputRequest(params) {
    if (!params || typeof params.sessionId !== "string" || typeof params.question !== "string") {
      throw new Error("Invalid user input request payload");
    }
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }
    const result = await session._handleUserInputRequest({
      question: params.question,
      choices: params.choices,
      allowFreeform: params.allowFreeform
    });
    return result;
  }
  async handleHooksInvoke(params) {
    if (!params || typeof params.sessionId !== "string" || typeof params.hookType !== "string") {
      throw new Error("Invalid hooks invoke payload");
    }
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }
    const output = await session._handleHooksInvoke(params.hookType, params.input);
    return { output };
  }
  async handleSystemMessageTransform(params) {
    if (!params || typeof params.sessionId !== "string" || !params.sections || typeof params.sections !== "object") {
      throw new Error("Invalid systemMessage.transform payload");
    }
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }
    return await session._handleSystemMessageTransform(params.sections);
  }
  // ========================================================================
  // Protocol v2 backward-compatibility adapters
  // ========================================================================
  /**
   * Handles a v2-style tool.call RPC request from the server.
   * Looks up the session and tool handler, executes it, and returns the result
   * in the v2 response format.
   */
  async handleToolCallRequestV2(params) {
    if (!params || typeof params.sessionId !== "string" || typeof params.toolCallId !== "string" || typeof params.toolName !== "string") {
      throw new Error("Invalid tool call payload");
    }
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Unknown session ${params.sessionId}`);
    }
    const handler = session.getToolHandler(params.toolName);
    if (!handler) {
      return {
        result: {
          textResultForLlm: `Tool '${params.toolName}' is not supported by this client instance.`,
          resultType: "failure",
          error: `tool '${params.toolName}' not supported`,
          toolTelemetry: {}
        }
      };
    }
    try {
      const traceparent = params.traceparent;
      const tracestate = params.tracestate;
      const invocation = {
        sessionId: params.sessionId,
        toolCallId: params.toolCallId,
        toolName: params.toolName,
        arguments: params.arguments,
        traceparent,
        tracestate
      };
      const result = await handler(params.arguments, invocation);
      return { result: this.normalizeToolResultV2(result) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        result: {
          textResultForLlm: "Invoking this tool produced an error. Detailed information is not available.",
          resultType: "failure",
          error: message,
          toolTelemetry: {}
        }
      };
    }
  }
  /**
   * Handles a v2-style permission.request RPC request from the server.
   */
  async handlePermissionRequestV2(params) {
    if (!params || typeof params.sessionId !== "string" || !params.permissionRequest) {
      throw new Error("Invalid permission request payload");
    }
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`);
    }
    try {
      const result = await session._handlePermissionRequestV2(params.permissionRequest);
      return { result };
    } catch (error) {
      if (error instanceof Error && error.message === NO_RESULT_PERMISSION_V2_ERROR) {
        throw error;
      }
      return {
        result: {
          kind: "user-not-available"
        }
      };
    }
  }
  normalizeToolResultV2(result) {
    if (result === void 0 || result === null) {
      return {
        textResultForLlm: "Tool returned no result",
        resultType: "failure",
        error: "tool returned no result",
        toolTelemetry: {}
      };
    }
    if (this.isToolResultObject(result)) {
      return result;
    }
    const textResult = typeof result === "string" ? result : JSON.stringify(result);
    return {
      textResultForLlm: textResult,
      resultType: "success",
      toolTelemetry: {}
    };
  }
  isToolResultObject(value) {
    return typeof value === "object" && value !== null && "textResultForLlm" in value && typeof value.textResultForLlm === "string" && "resultType" in value;
  }
}
export {
  CopilotClient
};

import { CopilotClient } from "./client.js";
import {
  defaultJoinSessionPermissionHandler
} from "./types.js";
async function joinSession(config = {}) {
  const sessionId = process.env.SESSION_ID;
  if (!sessionId) {
    throw new Error(
      "joinSession() is intended for extensions running as child processes of the Copilot CLI."
    );
  }
  const client = new CopilotClient({ isChildProcess: true });
  return client.resumeSession(sessionId, {
    ...config,
    onPermissionRequest: config.onPermissionRequest ?? defaultJoinSessionPermissionHandler,
    disableResume: config.disableResume ?? true
  });
}
export {
  joinSession
};

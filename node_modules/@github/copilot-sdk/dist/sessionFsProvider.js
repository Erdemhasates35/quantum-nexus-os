function createSessionFsAdapter(provider) {
  return {
    readFile: async ({ path }) => {
      try {
        const content = await provider.readFile(path);
        return { content };
      } catch (err) {
        return { content: "", error: toSessionFsError(err) };
      }
    },
    writeFile: async ({ path, content, mode }) => {
      try {
        await provider.writeFile(path, content, mode);
        return void 0;
      } catch (err) {
        return toSessionFsError(err);
      }
    },
    appendFile: async ({ path, content, mode }) => {
      try {
        await provider.appendFile(path, content, mode);
        return void 0;
      } catch (err) {
        return toSessionFsError(err);
      }
    },
    exists: async ({ path }) => {
      try {
        return { exists: await provider.exists(path) };
      } catch {
        return { exists: false };
      }
    },
    stat: async ({ path }) => {
      try {
        return await provider.stat(path);
      } catch (err) {
        return {
          isFile: false,
          isDirectory: false,
          size: 0,
          mtime: (/* @__PURE__ */ new Date()).toISOString(),
          birthtime: (/* @__PURE__ */ new Date()).toISOString(),
          error: toSessionFsError(err)
        };
      }
    },
    mkdir: async ({ path, recursive, mode }) => {
      try {
        await provider.mkdir(path, recursive ?? false, mode);
        return void 0;
      } catch (err) {
        return toSessionFsError(err);
      }
    },
    readdir: async ({ path }) => {
      try {
        const entries = await provider.readdir(path);
        return { entries };
      } catch (err) {
        return { entries: [], error: toSessionFsError(err) };
      }
    },
    readdirWithTypes: async ({ path }) => {
      try {
        const entries = await provider.readdirWithTypes(path);
        return { entries };
      } catch (err) {
        return { entries: [], error: toSessionFsError(err) };
      }
    },
    rm: async ({ path, recursive, force }) => {
      try {
        await provider.rm(path, recursive ?? false, force ?? false);
        return void 0;
      } catch (err) {
        return toSessionFsError(err);
      }
    },
    rename: async ({ src, dest }) => {
      try {
        await provider.rename(src, dest);
        return void 0;
      } catch (err) {
        return toSessionFsError(err);
      }
    }
  };
}
function toSessionFsError(err) {
  const e = err;
  const code = e.code === "ENOENT" ? "ENOENT" : "UNKNOWN";
  return { code, message: e.message ?? String(err) };
}
export {
  createSessionFsAdapter
};

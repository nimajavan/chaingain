/* eslint-disable @typescript-eslint/no-require-imports */
// Local Codex/Windows sandbox workaround: libuv may deny userInfo before tools start.
const os = require("node:os");
try {
  os.userInfo();
} catch {
  os.userInfo = () => ({ uid: -1, gid: -1, username: process.env.USERNAME || "codex", homedir: process.env.USERPROFILE || process.cwd(), shell: null });
}

/* global process */
// Skip Husky install on CI servers and Vercel deployments
if (process.env.CI || process.env.VERCEL) {
  process.exit(0);
}

const husky = (await import("husky")).default;
const output = husky();
if (output) {
  process.stdout.write(`husky - ${output}\n`);
}

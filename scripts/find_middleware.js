const fs = require("fs");
const path = require("path");

function findMiddleware(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file === ".next" || file === ".git") continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findMiddleware(fullPath);
    } else if (file.startsWith("middleware") && (file.endsWith(".ts") || file.endsWith(".js"))) {
      console.warn("FOUND:", fullPath);
    }
  }
}

findMiddleware(process.cwd());

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const desktopSrc = path.join(root, "../Octop/desktop/src");
const binName = "猛犸智能体";
const binPath = path.join(desktopSrc, "bin", binName);
const appPath = path.join(desktopSrc, "bin", `${binName}.dev.app`);
const octopPort = "8088";
const pagePort = "5210";
const pageUrl = `http://127.0.0.1:${pagePort}/`;

const children = [];

function start(name, command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) return;
    console.error(`[${name}] exited ${code ?? 0}`);
    stopAll();
    process.exit(code ?? 1);
  });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM");
    }
  }
}

function waitPort(port, label, timeoutMs = 60_000) {
  const startAt = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const socket = net.connect({ port, host: "127.0.0.1" }, () => {
        socket.end();
        console.log(`[desktop] ${label} ready (:${port})`);
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - startAt > timeoutMs) {
          reject(new Error(`timeout waiting for ${label} :${port}`));
          return;
        }
        setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

console.log("桌面联调：本机页面", pageUrl, "接口走已启动的 Octop", octopPort);
console.log("请先起: pnpm dev  +  pnpm octop。不要再另开一个 Octop。");

start("page", "npm", ["run", "dev"], {
  cwd: path.join(root, "../Octop/dashboard"),
  env: {
    ...process.env,
    VITE_BASE: "/",
    VITE_DEV_PORT: pagePort,
    VITE_API_PORT: octopPort,
    VITE_HMR_CLIENT_PORT: pagePort,
  },
});

await waitPort(Number(pagePort), "dashboard");

console.log("[desktop] building", binName, "...");
const build = spawnSync(
  "go",
  ["build", "-buildvcs=false", "-o", binPath, "."],
  {
    cwd: desktopSrc,
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/go/bin:${process.env.PATH ?? ""}`,
      CGO_ENABLED: "1",
      MACOSX_DEPLOYMENT_TARGET: "12.0",
    },
    stdio: "inherit",
  },
);
if (build.status !== 0) {
  console.error("[desktop] go build failed");
  stopAll();
  process.exit(build.status ?? 1);
}

function wrapDarwinDevApp() {
  const macOS = path.join(appPath, "Contents", "MacOS");
  const resources = path.join(appPath, "Contents", "Resources");
  fs.mkdirSync(macOS, { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  fs.copyFileSync(
    path.join(desktopSrc, "build/darwin/icons.icns"),
    path.join(resources, "icons.icns"),
  );
  fs.copyFileSync(binPath, path.join(macOS, binName));
  fs.chmodSync(path.join(macOS, binName), 0o755);
  fs.copyFileSync(
    path.join(desktopSrc, "build/darwin/Info.dev.plist"),
    path.join(appPath, "Contents", "Info.plist"),
  );
  const sign = spawnSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", appPath],
    { stdio: "inherit" },
  );
  if (sign.status !== 0) {
    console.warn("[desktop] codesign failed; Dock icon may stay generic");
  }
  return path.join(macOS, binName);
}

const launchPath =
  process.platform === "darwin" ? wrapDarwinDevApp() : binPath;

console.log("[desktop] launching", launchPath);
start("desktop", launchPath, [], {
  cwd: desktopSrc,
  env: {
    ...process.env,
    PATH: `${process.env.HOME}/go/bin:${process.env.PATH ?? ""}`,
    OCTOP_DESKTOP_URL: pageUrl,
    OCTOP_DESKTOP_DEVTOOLS: "1",
  },
});

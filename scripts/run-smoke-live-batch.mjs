#!/usr/bin/env node

import { spawn } from "node:child_process";

function readInteger(name, fallback, options = {}) {
  const { allowZero = false, minimum = 1 } = options;
  const raw = process.env[name];

  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }

  const value = Number.parseInt(String(raw), 10);

  if (!Number.isFinite(value) || value < minimum || (!allowZero && value === 0)) {
    throw new Error(`Invalid ${name} value: ${raw}`);
  }

  return value;
}

function waitForExit(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      windowsHide: true,
      shell: false,
    });

    const handleSignal = (signal) => {
      if (!child.killed) {
        child.kill(signal);
      }
    };

    process.once("SIGINT", handleSignal);
    process.once("SIGTERM", handleSignal);

    child.on("error", (error) => {
      process.removeListener("SIGINT", handleSignal);
      process.removeListener("SIGTERM", handleSignal);
      reject(error);
    });

    child.on("exit", (code, signal) => {
      process.removeListener("SIGINT", handleSignal);
      process.removeListener("SIGTERM", handleSignal);

      if (signal) {
        reject(new Error(`Smoke batch exited because of ${signal}.`));
        return;
      }

      if (code && code !== 0) {
        reject(new Error(`Smoke batch exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

async function main() {
  const batches = readInteger("SMOKE_LIVE_E2E_BATCHES", 10);
  const loops = readInteger("SMOKE_LIVE_E2E_LOOPS", 10);
  const pauseMs = readInteger("SMOKE_LIVE_E2E_BATCH_PAUSE_MS", 0, { allowZero: true, minimum: 0 });
  const totalLoops = batches * loops;
  const liveLoopCommand =
    process.platform === "win32"
      ? {
          command: "cmd.exe",
          args: ["/d", "/s", "/c", "npm run smoke:e2e:live-loop"],
        }
      : {
          command: "npm",
          args: ["run", "smoke:e2e:live-loop"],
        };

  console.log(`Running live smoke batch plan: ${batches} batches x ${loops} loops = ${totalLoops} loops total.`);

  for (let index = 1; index <= batches; index += 1) {
    const startedAt = Date.now();
    console.log(`Batch ${index}/${batches}: starting ${loops} live loops.`);

    await waitForExit(
      liveLoopCommand.command,
      liveLoopCommand.args,
      {
        ...process.env,
        SMOKE_LIVE_E2E_LOOPS: String(loops),
      },
    );

    const elapsedMs = Date.now() - startedAt;
    console.log(`Batch ${index}/${batches}: completed in ${Math.max(1, Math.round(elapsedMs / 1000))}s.`);

    if (index < batches && pauseMs > 0) {
      console.log(`Pausing ${pauseMs}ms before the next batch.`);
      await new Promise((resolve) => setTimeout(resolve, pauseMs));
    }
  }

  console.log(`Live smoke batch plan finished: ${totalLoops} loops total.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

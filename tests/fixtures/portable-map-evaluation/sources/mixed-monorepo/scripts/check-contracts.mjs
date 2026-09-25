import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseDispatchEvent } from "../apps/dispatch-console/src/application/contracts.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const classes = process.argv[2];
if (!classes) throw new Error("usage: node scripts/check-contracts.mjs <java-classes>");

const event = JSON.parse(await readFile(path.join(root, "contracts/dispatch-event.example.json"), "utf8"));
parseDispatchEvent(event);

const python = spawn("python3", ["-m", "routeplanner.contracts", "--probe"], {
  cwd: path.join(root, "workers/route-planner"),
  env: {...process.env, PYTHONPATH: path.join(root, "workers/route-planner/src"), PYTHONDONTWRITEBYTECODE: "1"},
});
const java = spawn("java", ["-cp", classes, "com.marketroute.fulfillment.ContractProbe"]);
const payload = JSON.stringify(event);
python.stdin.end(payload);
java.stdin.end(payload);
const wait = (child) => new Promise((resolve, reject) => {
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(output)));
});
const [pythonResult, javaResult] = await Promise.all([wait(python), wait(java)]);
if (pythonResult !== "dispatch.assigned:ASSIGNED" || javaResult !== "dispatch.assigned:ASSIGNED") {
  throw new Error(`contract probes disagreed: python=${pythonResult}, java=${javaResult}`);
}
console.log("cross-language dispatch contract: PASS");

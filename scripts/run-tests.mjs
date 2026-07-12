import { spawn } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TEST_ROOT = "tests";
const FIXTURE_ROOT = "tests/fixtures";
const SERIAL_TESTS = new Set([
  "tests/built-schema-assets.test.ts",
  "tests/built-assets-smoke.test.ts"
]);

function toPosixPath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await walk(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

export async function discoverTestFiles(repoRoot = process.cwd()) {
  const testsRoot = path.join(repoRoot, TEST_ROOT);
  const fixtureRoot = `${path.join(repoRoot, FIXTURE_ROOT)}${path.sep}`;
  const files = (await walk(testsRoot))
    .filter((filePath) => filePath.endsWith(".test.ts"))
    .filter((filePath) => !filePath.startsWith(fixtureRoot))
    .map((filePath) => toPosixPath(path.relative(repoRoot, filePath)))
    .sort((left, right) => left.localeCompare(right, "en"));
  const uniqueFiles = [...new Set(files)];

  if (uniqueFiles.length !== files.length) {
    throw new Error("Test discovery produced duplicate paths.");
  }

  return uniqueFiles;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: options.stdio ?? "inherit",
      windowsHide: true
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by ${signal}.`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}

export async function runTestFiles(testFiles, options = {}) {
  if (testFiles.length === 0) {
    throw new Error("Refusing to run an empty test inventory.");
  }

  const tsxCli = fileURLToPath(import.meta.resolve("tsx/cli"));
  return run(process.execPath, [tsxCli, "--test", ...testFiles], options);
}

async function gitStatus(repoRoot) {
  let output = "";
  const git = spawn("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true
  });

  git.stdout.setEncoding("utf8");
  git.stdout.on("data", (chunk) => {
    output += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    git.on("error", reject);
    git.on("close", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`git status exited ${exitCode}.`);
  }

  return output;
}

async function checkoutFileList(repoRoot) {
  const files = [];
  const directories = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === "node_modules") {
        continue;
      }

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        directories.push(toPosixPath(path.relative(repoRoot, entryPath)));
        await visit(entryPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(toPosixPath(path.relative(repoRoot, entryPath)));
      }
    }
  }

  await visit(repoRoot);
  return {
    directories: directories.sort((left, right) => left.localeCompare(right, "en")),
    files: files.sort((left, right) => left.localeCompare(right, "en"))
  };
}

async function capturePath(filePath) {
  try {
    const stats = await lstat(filePath);

    if (stats.isSymbolicLink()) {
      return {
        kind: "symlink",
        mode: stats.mode,
        target: await readlink(filePath)
      };
    }

    return {
      contents: await readFile(filePath),
      kind: "file",
      mode: stats.mode
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function captureCheckout(repoRoot) {
  const inventory = await checkoutFileList(repoRoot);
  const files = new Map();

  for (const relativePath of inventory.files) {
    const snapshot = await capturePath(path.join(repoRoot, relativePath));
    if (snapshot) {
      files.set(relativePath, snapshot);
    }
  }

  return { directories: new Set(inventory.directories), files };
}

function snapshotsEqual(left, right) {
  if (!left || !right || left.kind !== right.kind || left.mode !== right.mode) {
    return false;
  }

  if (left.kind === "symlink") {
    return left.target === right.target;
  }

  return left.contents.equals(right.contents);
}

async function restoreCheckout(repoRoot, before) {
  const after = await checkoutFileList(repoRoot);
  const beforePaths = new Set(before.files.keys());

  for (const relativePath of after.files) {
    if (beforePaths.has(relativePath)) {
      continue;
    }

    const absolutePath = path.join(repoRoot, relativePath);
    await rm(absolutePath, { recursive: true, force: true });
  }

  const newDirectories = after.directories
    .filter((relativePath) => !before.directories.has(relativePath))
    .sort((left, right) => right.length - left.length);
  for (const relativePath of newDirectories) {
    await rm(path.join(repoRoot, relativePath), { recursive: true, force: true });
  }

  for (const relativePath of before.directories) {
    await mkdir(path.join(repoRoot, relativePath), { recursive: true });
  }

  for (const [relativePath, snapshot] of before.files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const current = await capturePath(absolutePath);
    if (snapshotsEqual(snapshot, current)) {
      continue;
    }

    await rm(absolutePath, { recursive: true, force: true });
    await mkdir(path.dirname(absolutePath), { recursive: true });
    if (snapshot.kind === "symlink") {
      await symlink(snapshot.target, absolutePath);
    } else {
      await writeFile(absolutePath, snapshot.contents);
      await chmod(absolutePath, snapshot.mode);
    }
  }
}

export async function withCheckoutHygiene(repoRoot, work) {
  const statusBefore = await gitStatus(repoRoot);
  const checkoutBefore = await captureCheckout(repoRoot);
  let exitCode = 1;
  let thrownError;

  try {
    exitCode = await work();
  } catch (error) {
    thrownError = error;
  } finally {
    await restoreCheckout(repoRoot, checkoutBefore);
  }

  const statusAfter = await gitStatus(repoRoot);
  if (statusAfter !== statusBefore) {
    process.stderr.write(
      [
        "Canonical tests changed checkout state.",
        "Before:",
        statusBefore || "(clean)",
        "After:",
        statusAfter || "(clean)"
      ].join("\n")
    );
    return 1;
  }

  if (thrownError) {
    throw thrownError;
  }

  return exitCode;
}

export async function runCanonicalTests(repoRoot = process.cwd()) {
  const testFiles = await discoverTestFiles(repoRoot);
  const parallelTests = testFiles.filter((filePath) => !SERIAL_TESTS.has(filePath));
  const serialTests = testFiles.filter((filePath) => SERIAL_TESTS.has(filePath));

  if (serialTests.length !== SERIAL_TESTS.size) {
    throw new Error("The built-asset serial test inventory is incomplete.");
  }

  process.stdout.write(
    `Canonical inventory: ${testFiles.length} files (${parallelTests.length} parallel, ${serialTests.length} built-asset serial).\n`
  );

  return withCheckoutHygiene(repoRoot, async () => {
    const buildExitCode = await run(
      process.platform === "win32" ? "npm.cmd" : "npm",
      ["run", "build", "--silent"],
      { cwd: repoRoot }
    );
    if (buildExitCode !== 0) {
      return buildExitCode;
    }

    const parallelExitCode = await runTestFiles(parallelTests, { cwd: repoRoot });
    if (parallelExitCode !== 0) {
      return parallelExitCode;
    }

    for (const testFile of serialTests) {
      const serialExitCode = await runTestFiles([testFile], { cwd: repoRoot });
      if (serialExitCode !== 0) {
        return serialExitCode;
      }
    }

    return 0;
  });
}

async function main() {
  const repoRoot = process.cwd();
  const args = process.argv.slice(2);

  if (args.length === 1 && args[0] === "--list") {
    process.stdout.write(`${(await discoverTestFiles(repoRoot)).join("\n")}\n`);
    return;
  }

  if (args.length > 0) {
    throw new Error(
      "npm test does not accept file arguments; use npm run test:focused -- <test-files>."
    );
  }

  process.exitCode = await runCanonicalTests(repoRoot);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}

import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createGitRepo } from "./helpers/git-fixtures.js";
import { blueprintMapPrepare, blueprintMapSubmit } from "../src/mcp/tools/map.js";
import { CODEBASE_DOCUMENT_IDS, type CodebaseMapModel } from "../src/mcp/codebase-authoring.js";
import { CODEBASE_ARTIFACTS, CODEBASE_PUBLICATION_PATH, blueprintArtifactValidate, blueprintCodebaseArtifactWrite, inspectBlueprintArtifacts } from "../src/mcp/tools/artifacts.js";
import { readResearchEvidence, researchInputHash } from "../src/mcp/tools/research-evidence.js";
import { readDiscussEvidence } from "../src/mcp/tools/discuss-evidence.js";
import { blueprintProjectStatus } from "../src/mcp/tools/project.js";
import { blueprintToolRegistry, executeToolHandlerWithFailureLogging, sanitizeToolResultForPublicResponse } from "../src/mcp/server.js";

async function fixture(t: {after(fn: () => Promise<void>): void}) {
  const root = await createGitRepo("map-publication-");
  t.after(() => fs.rm(path.dirname(root), {recursive: true, force: true}));
  await fs.mkdir(path.join(root, "src"));
  await fs.writeFile(path.join(root, "src/index.ts"), "export const greeting = 'Hello';\n");
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({name:"example",type:"module",scripts:{test:"node --test"}}));
  return root;
}
function model(): CodebaseMapModel {
  const descriptions = {
    stack: "package.json selects ESM and declares the Node test command.",
    architecture: "The source entry point exports a greeting; no application server is defined in the inspected source.",
    structure: "src/index.ts contains the implementation. Add related source beside this entry point.",
    conventions: "The source uses named exports and single-quoted string literals.",
    testing: "package.json declares node --test; no test results were collected during mapping.",
    integrations: "The inspected package and entry point declare no external service integration.",
    concerns: "Only the entry point and manifest were inspected; verify runtime consumers before changing the export."
  };
  return Object.fromEntries(CODEBASE_DOCUMENT_IDS.map(id => [id,{summary:descriptions[id], evidencePaths:[id === "stack" || id === "testing" ? "package.json" : "src/index.ts"]}])) as CodebaseMapModel;
}
async function prepare(root: string) {
  const result = await blueprintMapPrepare({cwd:root, inputs:["package.json","src/index.ts"]});
  assert.equal(result.status, "ready");
  assert.ok(result.snapshot);
  return result.snapshot;
}
async function contents(root: string) {
  return Promise.all(CODEBASE_ARTIFACTS.map(p => fs.readFile(path.join(root,p),"utf8").catch(() => null)));
}

test("sparse mappings publish first time and downstream treats the bundle as mapped", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  assert.deepEqual(await contents(root), Array(7).fill(null));
  const documents = model();
  documents.architecture!.sections = [{heading:"Example",content:"```md\n## This is code, not a section\n```\nUnicode café and literal `app/[id]/page.tsx` remain intact."}, {heading:"Notes",content:""}];
  documents.integrations!.sections = [{heading:"Authentication",content:"None"}];
  const result = await blueprintMapSubmit({cwd:root,snapshot,documents});
  assert.equal(result.status,"published",JSON.stringify(result));
  assert.equal(result.saved,true);
  assert.equal(result.nextAction,"/blu-new-project");
  assert.equal((await blueprintProjectStatus({cwd:root})).status,"mapped-only");
  assert.equal((await blueprintArtifactValidate({cwd:root})).valid,true);
  assert.match((await contents(root))[1]!, /app\/\[id\]\/page\.tsx/);
  assert.match((await readResearchEvidence(root,CODEBASE_ARTIFACTS[0])).content!,/ESM/);
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents})).status,"reused");
  const reuse = await blueprintMapPrepare({cwd:root});
  assert.equal(reuse.status,"reused");
  assert.deepEqual(reuse.requiredDocuments,[]);
  const publicResult = sanitizeToolResultForPublicResponse("blueprint_map_prepare", reuse);
  assert.ok(publicResult.snapshot);
  assert.ok(publicResult.authoring);
});

test("invalid whole bundle never partially writes or logs rejected documents", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  const documents = model();
  documents.testing!.summary = "REJECTED_PRIVATE_DOCUMENT";
  documents.concerns!.evidencePaths = ["../../outside.txt"];
  const result = await executeToolHandlerWithFailureLogging(blueprintToolRegistry.blueprint_map_submit!, {cwd:root,snapshot,documents});
  assert.equal(result.status,"invalid");
  assert.deepEqual(await contents(root),Array(7).fill(null));
  const log = await fs.readFile(path.join(root,".blueprint/mcp-write-failures.ndjson"),"utf8");
  assert.doesNotMatch(log,/REJECTED_PRIVATE_DOCUMENT|outside\.txt|declares node/);
  await assert.rejects(fs.access(path.join(root,CODEBASE_PUBLICATION_PATH)));
});

test("omitted required documents reject; optional unchanged documents are reused", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents:{stack:model().stack}})).status,"invalid");
  assert.deepEqual(await contents(root),Array(7).fill(null));
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents:model()})).status,"published");
  const before = await contents(root);
  const next = await blueprintMapPrepare({cwd:root,inputs:["package.json"]});
  const refresh = {stack:{summary:"The ESM package declares node --test in package.json.",evidencePaths:["package.json"]}};
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot:next.snapshot!,documents:refresh})).saved,false);
  assert.deepEqual(await contents(root),before);
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot:next.snapshot!,documents:refresh,overwrite:true})).status,"published");
  assert.deepEqual((await contents(root)).slice(1),before.slice(1));
});

test("changed evidence and targets block writes even with replacement authorized", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  await fs.writeFile(path.join(root,"src/index.ts"),"export const greeting = 'Changed';\n");
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents:model(),overwrite:true})).status,"stale");
  assert.deepEqual(await contents(root),Array(7).fill(null));
  const next = await prepare(root);
  await fs.mkdir(path.join(root,".blueprint/codebase"),{recursive:true});
  await fs.writeFile(path.join(root,CODEBASE_ARTIFACTS[0]),"# Stack\n\nA concurrent mapping result.\n");
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot:next,documents:model(),overwrite:true})).status,"stale");
  assert.match((await contents(root))[0]!,/concurrent mapping/);
});

test("partial writes retain hashes only, are withheld downstream, and resume", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  const originalRename = fs.rename;
  const fail = t.mock.method(fs,"rename",async (from: Parameters<typeof fs.rename>[0],to: Parameters<typeof fs.rename>[1]) => {
    if (String(to).endsWith("ARCHITECTURE.md")) throw new Error("simulated I/O failure");
    return originalRename(from,to);
  });
  const documents = model();
  const first = await blueprintMapSubmit({cwd:root,snapshot,documents});
  assert.equal(first.status,"partial");
  fail.mock.restore();
  const pending = await fs.readFile(path.join(root,CODEBASE_PUBLICATION_PATH),"utf8");
  assert.doesNotMatch(pending,/greeting|single-quoted|summary|sections/);
  assert.equal((await inspectBlueprintArtifacts(root)).codebase.mapped,false);
  await assert.rejects(readResearchEvidence(root,CODEBASE_ARTIFACTS[0]),/incomplete/);
  await assert.rejects(researchInputHash(root,CODEBASE_ARTIFACTS[0]),/incomplete/);
  await assert.rejects(readDiscussEvidence(root,CODEBASE_ARTIFACTS[0]),/incomplete/);
  assert.equal((await blueprintMapPrepare({cwd:root})).status,"partial");
  const reordered = {...snapshot, inputs: Object.fromEntries(Object.entries(snapshot.inputs).reverse())};
  const retry = await blueprintMapSubmit({cwd:root,snapshot:reordered,documents});
  assert.equal(retry.status,"published",JSON.stringify(retry));
  assert.equal((await inspectBlueprintArtifacts(root)).codebase.mapped,true);
  await assert.rejects(fs.access(path.join(root,CODEBASE_PUBLICATION_PATH)));
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents})).status,"reused");
});

test("legacy writer preserves non-scaffold invalid artifacts until explicit replacement", async t => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root,".blueprint/codebase"),{recursive:true});
  const file = path.join(root,CODEBASE_ARTIFACTS[0]);
  await fs.writeFile(file,"# Stack\n\n## Purpose\n\n<runtime>\n");
  await assert.rejects(blueprintCodebaseArtifactWrite({cwd:root,artifactId:"codebase.stack",content:"# Stack\n\nNode ESM is configured in package.json.\n"}),/confirmation/);
  assert.match(await fs.readFile(file,"utf8"),/<runtime>/);
});

test("prepare rejects traversal and external symlink evidence before generation", async t => {
  const root = await fixture(t);
  await assert.rejects(blueprintMapPrepare({cwd:root,inputs:["../outside.ts"]}),/traversal|relative/);
  await fs.writeFile(path.join(path.dirname(root),"outside.ts"), "export const outside = true;");
  await fs.symlink(path.join(path.dirname(root),"outside.ts"),path.join(root,"src/link.ts"));
  await assert.rejects(blueprintMapPrepare({cwd:root,inputs:["src/link.ts"]}),/traversal/);
});

test("concurrent changes to an omitted reusable document are not silently adopted", async t => {
  const root = await fixture(t);
  await blueprintMapSubmit({cwd:root,snapshot:await prepare(root),documents:model()});
  const before = await blueprintMapPrepare({cwd:root,inputs:["package.json"]});
  await fs.appendFile(path.join(root,CODEBASE_ARTIFACTS[1]),"\nConcurrent refreshed architecture.\n");
  const result = await blueprintMapSubmit({cwd:root,snapshot:before.snapshot!,documents:{stack:{summary:"Updated stack evidence from package.json.",evidencePaths:["package.json"]}},overwrite:true});
  assert.equal(result.status,"stale");
  assert.match((await contents(root))[1]!,/Concurrent/);
});

test("lost-model partial publication can restart from fresh evidence without deleting accepted files", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  const originalRename = fs.rename;
  const fail = t.mock.method(fs,"rename",async (from: Parameters<typeof fs.rename>[0],to: Parameters<typeof fs.rename>[1]) => {
    if (String(to).endsWith("ARCHITECTURE.md")) throw new Error("simulated I/O failure");
    return originalRename(from,to);
  });
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents:model()})).status,"partial");
  fail.mock.restore();
  const acceptedStack = await fs.readFile(path.join(root,CODEBASE_ARTIFACTS[0]),"utf8");
  await fs.writeFile(path.join(root,"src/index.ts"),"export const greeting = 'Changed';\n");
  const restart = await blueprintMapPrepare({cwd:root,inputs:["package.json","src/index.ts"],restart:true});
  assert.equal(restart.status,"ready");
  assert.deepEqual(restart.requiredDocuments,[...CODEBASE_DOCUMENT_IDS]);
  assert.equal(await fs.readFile(path.join(root,CODEBASE_ARTIFACTS[0]),"utf8"),acceptedStack);
  const invalid = await blueprintMapSubmit({cwd:root,snapshot:restart.snapshot!,documents:{stack:model().stack},overwrite:true});
  assert.equal(invalid.saved,false);
  assert.equal(await fs.readFile(path.join(root,CODEBASE_ARTIFACTS[0]),"utf8"),acceptedStack);
  const result = await blueprintMapSubmit({cwd:root,snapshot:restart.snapshot!,documents:model(),overwrite:true});
  assert.equal(result.status,"published",JSON.stringify(result));
  assert.equal((await inspectBlueprintArtifacts(root)).codebase.mapped,true);
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot:restart.snapshot!,documents:model(),overwrite:true})).status,"reused");
});

test("unknown pending metadata blocks legacy restart until a reviewed portable replacement exists", async t => {
  const root = await fixture(t);
  await fs.mkdir(path.join(root,".blueprint/codebase"),{recursive:true});
  await fs.writeFile(path.join(root,CODEBASE_PUBLICATION_PATH),"{broken metadata");
  const pending = await blueprintMapPrepare({cwd:root});
  assert.equal(pending.status,"blocked");
  const restart = await blueprintMapPrepare({cwd:root,inputs:["package.json","src/index.ts"],restart:true});
  assert.equal(restart.status,"blocked");
  assert.equal(await fs.readFile(path.join(root,CODEBASE_PUBLICATION_PATH),"utf8"),"{broken metadata");
});

test("source changes during writes keep the bundle pending until a fresh restart", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  const originalRename = fs.rename;
  const change = t.mock.method(fs,"rename",async (from: Parameters<typeof fs.rename>[0],to: Parameters<typeof fs.rename>[1]) => {
    await originalRename(from,to);
    if (String(to).endsWith("STACK.md")) await fs.writeFile(path.join(root,"src/index.ts"),"export const greeting = 'Changed during publication';\n");
  });
  const result = await blueprintMapSubmit({cwd:root,snapshot,documents:model()});
  change.mock.restore();
  assert.equal(result.status,"partial");
  assert.equal((await inspectBlueprintArtifacts(root)).codebase.mapped,false);
});

test("source aliases cannot disclose secrets or runtime state", async t => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root,".env"),"SECRET_SENTINEL=value\n");
  await fs.symlink("../.env",path.join(root,"src/alias.ts"));
  await assert.rejects(blueprintMapPrepare({cwd:root,inputs:["src/alias.ts"]}),/symlink/);
  await fs.mkdir(path.join(root,".blueprint/private"),{recursive:true});
  await fs.writeFile(path.join(root,".blueprint/private/data.ts"),"RUNTIME_PRIVATE_DATA");
  await fs.symlink("../.blueprint/private",path.join(root,"src/aliasdir"));
  await assert.rejects(blueprintMapPrepare({cwd:root,inputs:["src/aliasdir/data.ts"]}),/excluding runtime/);
});

test("a fully written pending bundle resumes without regenerating documents", async t => {
  const root = await fixture(t);
  const snapshot = await prepare(root);
  const originalUnlink = fs.unlink;
  const fail = t.mock.method(fs,"unlink",async (file: Parameters<typeof fs.unlink>[0]) => {
    if (String(file).endsWith(".publication.json")) throw new Error("simulated marker cleanup failure");
    return originalUnlink(file);
  });
  assert.equal((await blueprintMapSubmit({cwd:root,snapshot,documents:model()})).status,"partial");
  fail.mock.restore();
  const retry = await blueprintMapSubmit({cwd:root,snapshot});
  assert.equal(retry.status,"published",JSON.stringify(retry));
  assert.equal((await inspectBlueprintArtifacts(root)).codebase.mapped,true);
});

test("a focus request prepares targeted deepening even when all documents are valid", async t => {
  const root = await fixture(t);
  await blueprintMapSubmit({cwd:root,snapshot:await prepare(root),documents:model()});
  const focused = await blueprintMapPrepare({cwd:root,inputs:["src/index.ts"],focus:"greeting export"});
  assert.equal(focused.status,"ready");
  assert.equal(focused.focus,"greeting export");
  assert.deepEqual(focused.requiredDocuments,[]);
  const result = await blueprintMapSubmit({cwd:root,snapshot:focused.snapshot!,documents:{architecture:{summary:"src/index.ts exports a greeting as a named module value; consumers import this module directly.",evidencePaths:["src/index.ts"]}},overwrite:true});
  assert.equal(result.status,"published");
  assert.equal(result.reused?.length,6);
});

test("prepare exposes missing evidence before expensive authoring", async t => {
  const root = await fixture(t);
  const result = await blueprintMapPrepare({cwd:root});
  assert.equal(result.status,"blocked");
  assert.match(result.issues.join(" "),/representative repository files/);
  assert.deepEqual(await contents(root),Array(7).fill(null));
});

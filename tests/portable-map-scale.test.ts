import test from "node:test";
import assert from "node:assert/strict";

import {
  createTemporaryScaleFixture,
  runPortableMapScale
} from "../scripts/portable-map-scale.ts";

test("manageable generated scale fixture exercises meaningful model and publication properties", async t => {
  const fixture = await createTemporaryScaleFixture({fileCount: 32, includeLargeFile: false});
  t.after(fixture.cleanup);

  assert.equal(fixture.manifest.fileCount, 32);
  assert.equal(Object.values(fixture.manifest.languageCounts).reduce((sum, count) => sum + count, 0), 32);
  assert.ok(fixture.manifest.knownResponsibilities.length >= 8);
  assert.equal(fixture.manifest.largeSource, null);

  const result = await runPortableMapScale(fixture.root, fixture.manifest);
  assert.equal(result.extraction.files, 32);
  assert.ok(result.extraction.symbols > 20);
  assert.ok(result.extraction.imports > 0);
  assert.ok(result.extraction.sourceHashManifest.records === 32);
  assert.equal(result.packets.losslessReconstruction, true);
  assert.equal(result.packets.allWithinUtf8Cap, true);
  assert.ok(result.packets.maxSerializedBytes <= 48 * 1024);
  assert.equal(result.authoredModel.validated, true);
  assert.equal(result.authoredModel.capabilities, 8);
  assert.equal(result.authoredModel.claims, 8);
  assert.equal(result.authoredModel.aliases, 8);
  assert.equal(result.authoredModel.documents, 7);
  assert.ok(result.authoredModel.completeSubmissionUtf8Bytes < 48 * 1024);
  assert.equal(result.rendering.compatibilityViews, 7);
  assert.equal(result.publication.first.committed, true);
  assert.equal(result.publication.secondGeneration.committed, true);
  assert.equal(result.publication.firstResolution.generationId, "gen-scale-001");
  assert.equal(result.publication.secondResolution.generationId, "gen-scale-002");
  assert.equal(result.publication.retainedFirstResolution.generationId, "gen-scale-001");
  assert.equal(result.publication.generationDisk.allocatedGenerationDirectories, 2);
  assert.deepEqual(result.publication.generationDisk.provedPublishedGenerationIds, ["gen-scale-001", "gen-scale-002"]);
  assert.equal(result.multipartDecision.requiresMultipart, false);
  assert.equal(result.operationContinuation.measured, false);
  assert.match(result.operationContinuation.method, /manageable operation fixture/i);
  assert.ok(result.memory.samples.length >= 4);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createFoodBox } from "../src/domain/box.ts";
import { validateSlotRequest } from "../src/domain/slot.ts";
import { loadConfig } from "../src/config.ts";

test("validates box and slot boundaries", () => {
  assert.equal(createFoodBox("box-1", "mixed", 3).weightKg, 3);
  assert.throws(() => validateSlotRequest({requestId: "", memberId: "m", depotCode: "NORTH-01", boxCount: 1, routeDate: "2026-09-25"}));
  assert.equal(loadConfig({MARKETROUTE_DEFAULT_DEPOT: "EAST-03", MARKETROUTE_DAILY_BOX_LIMIT: "20"}).defaultDepot, "EAST-03");
});

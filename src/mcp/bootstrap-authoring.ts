import * as z from "zod/v4";
import type { BootstrapSeed, BootstrapRequirementRow } from "./tools/artifacts.js";

const text = z.string().trim().min(1);
const optionalList = z.array(text).optional();

/** Author product decisions once; persistence owns identifiers and document shape. */
export const bootstrapAuthoringSchema = z.strictObject({
  vision: text.describe("The product's purpose and the outcome it enables."),
  audience: z.array(text).min(1).describe("Actual users; one audience is sufficient."),
  milestone: text.describe("Name of the first milestone, for example v1."),
  constraints: optionalList.describe("Only confirmed constraints. Omit or use [] when none are known."),
  assumptions: optionalList.describe("Unconfirmed assumptions or open questions, explicitly labeled. [] is valid."),
  phases: z.array(z.strictObject({
    title: text,
    objective: text,
    requirements: z.array(text).min(1).describe("User capabilities owned by this phase. Do not generate IDs or repeat another phase's requirements."),
    successCriteria: z.array(text).min(1).describe("Observable evidence of success. Usually 2-5; one precise criterion is sufficient."),
    dependsOn: optionalList.describe("Exact titles of earlier phases this phase requires. Omit when independent.")
  })).min(1).describe("Phases in delivery order. Runtime assigns phase numbers."),
  deferred: optionalList.describe("Capabilities for a later milestone, excluded from these phases."),
  outOfScope: optionalList.describe("Explicit exclusions, excluded from these phases.")
});

export type BootstrapAuthoringModel = z.infer<typeof bootstrapAuthoringSchema>;

const line = (value: string) => value.replace(/\s+/g, " ").trim();
const identity = (value: string) => line(value).toLocaleLowerCase("en-US");

export function compileBootstrapAuthoringModel(
  model: BootstrapAuthoringModel,
  previous: { id: string; requirement: string }[] = []
): BootstrapSeed {
  const previousIds = new Map(previous.map(row => [identity(row.requirement), row.id]));
  const allocated = new Set(previous.map(row => row.id));
  let nextId = 1;
  const requirements: BootstrapRequirementRow[] = [];
  const statements = new Set<string>();
  const titles = new Map<string, string>();
  const addRequirement = (value: string, scope: BootstrapRequirementRow["scope"], group: string) => {
    const key = identity(value);
    if (statements.has(key)) {
      throw new Error(`Requirement appears more than once or in conflicting scopes: ${line(value)}`);
    }
    statements.add(key);
    let id = previousIds.get(key);
    if (!id) {
      do {
        id = `RQ-${String(nextId++).padStart(2, "0")}`;
      } while (allocated.has(id));
      allocated.add(id);
    }
    requirements.push({ id, requirement: line(value), scope, group, status: "Pending", notes: "" });
    return id;
  };
  const roadmapPhases = model.phases.map((phase, index) => {
    const key = identity(phase.title);
    if (titles.has(key)) {
      throw new Error(`Phase titles must be distinct: ${line(phase.title)}`);
    }
    const dependencies = (phase.dependsOn ?? []).map(title => {
      const ref = titles.get(identity(title));
      if (!ref) {
        throw new Error(`Phase ${line(phase.title)} depends on an unknown or later phase: ${line(title)}. Put prerequisites first.`);
      }
      return ref;
    });
    const number = String(index + 1);
    titles.set(key, number);
    return {
      phase: number,
      title: line(phase.title),
      objective: line(phase.objective),
      requirementIds: phase.requirements.map(value => addRequirement(value, "committed", line(phase.title))),
      successCriteria: phase.successCriteria.map(line),
      dependencies: [...new Set(dependencies)]
    };
  });
  for (const value of model.deferred ?? []) {
    addRequirement(value, "deferred", "Later milestones");
  }
  for (const value of model.outOfScope ?? []) {
    addRequirement(value, "out_of_scope", "Explicit exclusions");
  }
  return {
    vision: line(model.vision),
    audience: { primary: model.audience.map(line), secondary: [] },
    currentMilestone: line(model.milestone),
    constraints: (model.constraints ?? []).map(line),
    nonGoals: (model.outOfScope ?? []).map(line),
    assumptions: (model.assumptions ?? []).map(line),
    requirements,
    roadmapPhases
  };
}

export function readPreviousBootstrapRequirementIds(markdown: string): { id: string; requirement: string }[] {
  return [...markdown.matchAll(/^\|\s*([A-Z][A-Z0-9-]*-\d+)\s*\|\s*((?:\\\||[^|])*)\|/gm)]
    .map(match => ({ id: match[1]!, requirement: match[2]!.trim().replace(/\\\|/g, "|") }));
}

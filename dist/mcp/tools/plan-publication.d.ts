export type PlanPublicationStatus = {
    status: "absent" | "pending" | "committed" | "invalid";
    token: string;
    reason: string | null;
};
/** Readers compare tokens before and after a read to reject mixed generations. */
export declare function readPlanPublicationStatus(projectRoot: string, phaseDir: string, phasePrefix: string): Promise<PlanPublicationStatus>;

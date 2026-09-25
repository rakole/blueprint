import {ValidationError} from "./errors.ts";
import type {MemberId} from "../types/ids.ts";

export type MemberStatus = "active" | "suspended";

export class Member {
  readonly id: MemberId;
  readonly displayName: string;
  readonly status: MemberStatus;

  constructor(id: MemberId, displayName: string, status: MemberStatus = "active") {
    this.id = id;
    this.displayName = displayName;
    this.status = status;
    if (!displayName.trim()) {
      throw new ValidationError("member display name is required");
    }
  }

  canReserve(): boolean {
    return this.status === "active";
  }
}

import type {Member} from "../domain/member.ts";
import type {MemberId} from "../types/ids.ts";
import type {MemberRepository} from "./member-repository.ts";

export class InMemoryMemberRepository implements MemberRepository {
  private readonly records: readonly Member[];

  constructor(records: readonly Member[]) {
    this.records = records;
  }

  findById(id: MemberId): Member | undefined {
    return this.records.find((member) => member.id === id);
  }
}

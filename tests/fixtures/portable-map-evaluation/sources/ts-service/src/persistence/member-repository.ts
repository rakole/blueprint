import type {Member} from "../domain/member.ts";
import type {MemberId} from "../types/ids.ts";

export interface MemberRepository {
  findById(id: MemberId): Member | undefined;
}

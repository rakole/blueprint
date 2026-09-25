import type {ToolId} from "../types/ids.ts";

export type ReservationFormProps = {
  toolId: ToolId;
  minStart: string;
};

export function ReservationForm({toolId, minStart}: ReservationFormProps): JSX.Element {
  return (
    <form data-tool-id={toolId} method="post" action="/reservations">
      <label>Start <input name="startsAt" type="datetime-local" min={minStart} required /></label>
      <label>End <input name="endsAt" type="datetime-local" min={minStart} required /></label>
      <button type="submit">Hold tool</button>
    </form>
  );
}

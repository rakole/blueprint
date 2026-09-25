export function ReservationSummary({reservation}) {
  const label = reservation.status === "cancelled" ? "Cancelled" : "Reserved";
  return (
    <section data-status={reservation.status}>
      <h2>{label}</h2>
      <p>{reservation.startsAt} to {reservation.endsAt}</p>
    </section>
  );
}

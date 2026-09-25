export function StatusBadge({status}) {
  return {type: "span", props: {className: `status-${status.toLowerCase()}`, children: status}};
}

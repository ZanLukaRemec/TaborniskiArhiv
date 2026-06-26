const STATUS_LABELS = {
  arhivirano: 'Arhivirano',
  osnutek: 'Osnutek',
}

function StatusBadge({ status }) {
  return (
    <span className={`status ${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}

export default StatusBadge

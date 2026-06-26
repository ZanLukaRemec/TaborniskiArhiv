function SummaryCards({ archivedCount, categoryCount, draftCount, reportCount }) {
  return (
    <section className="summary-grid" aria-label="Pregled sistema">
      <article className="summary-card green">
        <span className="metric">{reportCount}</span>
        <p>Poročila</p>
      </article>
      <article className="summary-card blue">
        <span className="metric">{archivedCount}</span>
        <p>Arhivirana</p>
      </article>
      <article className="summary-card peach">
        <span className="metric">{draftCount}</span>
        <p>Osnutki</p>
      </article>
      <article className="summary-card violet">
        <span className="metric">{categoryCount}</span>
        <p>Kategorije</p>
      </article>
    </section>
  )
}

export default SummaryCards

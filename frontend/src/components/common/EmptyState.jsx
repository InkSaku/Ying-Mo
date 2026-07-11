export default function EmptyState({ title = '暂无内容。', description }) {
  return (
    <section className="state-message">
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  )
}

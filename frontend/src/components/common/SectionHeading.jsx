export default function SectionHeading({ eyebrow, title, description, titleId }) {
  return (
    <header className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={titleId}>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  )
}

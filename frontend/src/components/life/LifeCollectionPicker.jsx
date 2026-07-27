import AuthenticatedMedia from '../common/AuthenticatedMedia.jsx'

function CollectionCard({ collection, onSelect }) {
  return (
    <button className="collection-choice" type="button" onClick={() => onSelect(collection)}>
      <span className="collection-choice__cover">
        {collection.cover_thumbnail_url
          ? <AuthenticatedMedia src={collection.cover_thumbnail_url} alt={`${collection.name}合集封面`} fit="cover" />
          : <span aria-hidden="true">集</span>}
      </span>
      <span className="collection-choice__body">
        <span className="collection-choice__topline">
          <strong>{collection.name}</strong>
          <em>{collection.is_owner ? '我创建的' : '可投稿'}</em>
        </span>
        <span>{collection.description || `已经收录 ${collection.content_count || 0} 条内容`}</span>
        <small>{collection.is_owner ? '你可以在这里发布和管理内容' : '创建者允许符合条件的用户共同投稿'}</small>
      </span>
    </button>
  )
}

function CollectionGroup({ title, description, items, empty, onSelect }) {
  return (
    <section className="collection-picker__group">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      {items.length
        ? <div className="collection-choice-grid">{items.map((item) => <CollectionCard key={item.id} collection={item} onSelect={onSelect} />)}</div>
        : <p className="collection-picker__empty">{empty}</p>}
    </section>
  )
}

export default function LifeCollectionPicker({ collections, onSelect }) {
  return (
    <div className="collection-picker">
      <CollectionGroup
        title="我的合集"
        description="你创建并拥有的生活合集。"
        items={collections.owned || []}
        empty="还没有可发布的自有合集，可以先创建一个。"
        onSelect={onSelect}
      />
      <CollectionGroup
        title="我可以投稿的合集"
        description="这里只显示创建者明确开放投稿、且你当前有权发布的合集。"
        items={collections.contributing || []}
        empty="暂时没有其他向你开放投稿的合集。"
        onSelect={onSelect}
      />
    </div>
  )
}

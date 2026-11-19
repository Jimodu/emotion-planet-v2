import { albumEntries, timelineNotes, whispers } from '../data/mockData'

const pages = {
  tree: {
    kicker: 'THE HOLLOW',
    title: '树洞',
    description: '把不方便说出口的话轻轻放进这里。没有人知道是谁，但风会替你温柔地收好。',
    list: whispers,
    note: '这里收集匿名心情，页面还在慢慢生长。',
  },
  album: {
    kicker: 'THE ALBUM',
    title: '记录册',
    description: '那些被认真记下来的日子，都安静地躺在这里。翻开时，不必评价当时的自己。',
    list: albumEntries,
    note: '完整的情绪记录册正在整理中。',
  },
  time: {
    kicker: 'TIME MACHINE',
    title: '时光机',
    description: '回到某个时刻，看看那时候的自己。你会发现，一路走来，你已经很不容易了。',
    list: timelineNotes,
    note: '时光机还在校准方向，先看看这些旧片段。',
  },
}

export default function PlaceholderPage({ tab }) {
  const page = pages[tab] || pages.tree

  return (
    <section className="placeholder" aria-labelledby="placeholder-title">
      <div className={`placeholder-art art-${tab}`} aria-hidden="true">
        <span className="art-ring" />
        <span className="art-dot" />
        <span className="art-line" />
      </div>
      <p className="eyebrow">{page.kicker}</p>
      <h2 id="placeholder-title">{page.title}</h2>
      <p className="placeholder-desc">{page.description}</p>

      <div className="mock-list">
        {page.list.map((item) => (
          <article className="mock-item" key={item.id} style={{ '--mood-color': item.color }}>
            {(item.date || item.season) && (
              <span className="mock-date">
                {item.date || item.season}
                {item.label ? ` · ${item.label}` : ''}
                {item.season && item.date ? ` · ${item.season}` : ''}
              </span>
            )}
            <p>{item.text}</p>
          </article>
        ))}
      </div>

      <p className="coming-soon">{page.note}</p>
    </section>
  )
}

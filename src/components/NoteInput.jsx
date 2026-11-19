export default function NoteInput({ value, onChange }) {
  return (
    <div className="field">
      <p className="field-label">03 &nbsp; 想对自己说点什么？</p>
      <textarea
        className="note-area"
        value={value}
        rows={6}
        onChange={(event) => onChange(event.target.value)}
        placeholder="写下一句话就好，哪怕只是「有点累」。"
        aria-label="今天的心情文字"
      />
      <div className="char-count">{value.length} 字</div>
    </div>
  )
}

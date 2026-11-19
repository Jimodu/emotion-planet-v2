function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 6) return '夜深了，也别忘了温柔待自己。'
  if (hour < 11) return '清晨好，慢慢醒来也没关系。'
  if (hour < 18) return '下午好，记得给自己留一点空隙。'
  return '晚上好，今天也辛苦了。'
}

export default function Greeting() {
  return (
    <section className="greeting">
      <p className="eyebrow">TODAY · 今天</p>
      <h1>{getGreeting()}</h1>
      <p className="greeting-sub">「你不必成为更好的自己，也值得被温柔对待。」</p>
      <svg className="squiggle" width="96" height="13" viewBox="0 0 96 13" fill="none" aria-hidden="true">
        <path
          d="M2 9C14 3 23 11 35 6C47 1 56 11 68 6C78 2 87 8 94 5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </section>
  )
}

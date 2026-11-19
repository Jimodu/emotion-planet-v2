import { moods } from './moods'

function daysAgo(amount) {
  const date = new Date()
  date.setDate(date.getDate() - amount)
  return date.toISOString()
}

export const whispers = [
  { id: 'demo-1', text: '今天没有发生什么大事，但还是很想哭。也许只是太累了。', color: moods[3].color, publishedAt: daysAgo(1), isDemo: true },
  { id: 'demo-2', text: '下班路上看到很好看的晚霞，站在路口多看了两分钟。', color: moods[1].color, publishedAt: daysAgo(2), isDemo: true },
  { id: 'demo-3', text: '允许自己什么都不做的一个下午，原来也很好。', color: moods[0].color, publishedAt: daysAgo(4), isDemo: true },
  { id: 'demo-4', text: '把没说出口的话写在这里，希望风会替我轻轻放下。', color: moods[2].color, publishedAt: daysAgo(6), isDemo: true },
  { id: 'demo-5', text: '地铁上戴着耳机，忽然听到一首很久以前的歌。', color: moods[6].color, publishedAt: daysAgo(8), isDemo: true },
  { id: 'demo-6', text: '给今天的自己留了一小块蛋糕，算是小小的庆祝。', color: moods[8].color, publishedAt: daysAgo(11), isDemo: true },
  { id: 'demo-7', text: '有些话说不出口，写下来就好像轻了一点。', color: moods[10].color, publishedAt: daysAgo(14), isDemo: true },
  { id: 'demo-8', text: '窗外的雨下了一整晚，我睡得比想象中好。', color: moods[5].color, publishedAt: daysAgo(18), isDemo: true },
]

export const demoEchoes = [
  { id: 'echo-demo-1', targetId: 'demo-3', type: 'hug', author: '一位路过的风', note: '抱抱你，那个下午一定很安静。', createdAt: daysAgo(1) },
  { id: 'echo-demo-2', targetId: 'demo-2', type: 'star', author: '夜航的小星球', note: '那片晚霞，我也看见了。', createdAt: daysAgo(2) },
  { id: 'echo-demo-3', targetId: 'demo-6', type: 'hug', author: '靠岸的陌生人', note: '一小块蛋糕，也是很好的庆祝。', createdAt: daysAgo(10) },
  { id: 'echo-demo-4', targetId: 'demo-5', type: 'star', author: '听旧歌的人', note: '有些旋律，一响起来就回到从前。', createdAt: daysAgo(13) },
]

const DEMO_REPLY_POOL = [
  '我也会在没什么大事的日子里忽然很累，你不是一个人。',
  '写下来，也许就已经轻轻放下了一点。',
  '允许自己慢一点，也是一种很好的照顾。',
  '那两分钟的晚霞，我也替你记住了。',
  '你愿意把没说出口的话留在这里，已经很勇敢。',
  '旧歌一响，心里某个角落也会跟着亮一下。',
  '一小块蛋糕值得庆祝，你认真对待了自己。',
  '雨停之后，睡个好觉很重要。',
  '不用强迫自己好起来，今天先好好呼吸。',
  '风会替你收好这些话，慢慢来。',
  '这样的下午很安静，安静得刚好。',
  '想给你一个很轻的抱抱，不说话也可以。',
]

function stableScore(value) {
  let score = 0
  for (let index = 0; index < value.length; index += 1) {
    score = (score * 31 + value.charCodeAt(index)) % 100000
  }
  return score
}

const demoReplyTargets = [...whispers]
  .map((item) => ({ item, score: stableScore(item.id) }))
  .sort((a, b) => a.score - b.score)
  .slice(0, Math.max(1, Math.round(whispers.length * 0.25)))
  .map((entry) => entry.item)

export const demoReplies = demoReplyTargets.flatMap((item, targetIndex) => {
  const count = 1 + (stableScore(`${item.id}:count`) % 2)
  return Array.from({ length: count }, (_, index) => {
    const created = new Date(new Date(item.publishedAt).getTime() + (index + 1) * 3600000)
    return {
      id: `demo-reply-${item.id}-${index + 1}`,
      targetId: item.id,
      text: DEMO_REPLY_POOL[(stableScore(`${item.id}:${index}`) + targetIndex + index) % DEMO_REPLY_POOL.length],
      source: 'demo',
      createdAt: created.toISOString(),
    }
  })
})

export const albumEntries = [
  { id: 1, date: '11月14日', label: '平静', color: moods[0].color, text: '窗边坐了很久，什么也没想。' },
  { id: 2, date: '11月12日', label: '喜悦', color: moods[1].color, text: '收到了很久没联系的朋友的消息。' },
  { id: 3, date: '11月09日', label: '疲惫', color: moods[2].color, text: '会议很多，记得早点休息。' },
  { id: 4, date: '11月06日', label: '低落', color: moods[3].color, text: '有点丧，但还是好好吃了饭。' },
]

export const timelineNotes = [
  { id: 1, season: '初秋', date: '十月', text: '开始学着把感受写下来，而不是全部咽下去。', color: moods[0].color },
  { id: 2, season: '盛夏', date: '七月', text: '那天的雨很大，我在伞下笑得很轻易。', color: moods[1].color },
  { id: 3, season: '早春', date: '三月', text: '重新养了一盆植物，也重新养了自己一次。', color: moods[2].color },
]

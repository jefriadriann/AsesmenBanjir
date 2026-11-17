export const NEWS_REFRESH_MS = 4 * 60 * 60 * 1000;
export const NEWS_SOURCES = [
  {id: 'antara', name: 'ANTARA News', domain: 'antaranews.com'},
  {id: 'cnn', name: 'CNN Indonesia', domain: 'cnnindonesia.com'},
  {id: 'metro', name: 'Metro TV', domain: 'metrotvnews.com'},
  {id: 'reuters', name: 'Reuters', domain: 'reuters.com'},
  {id: 'ap', name: 'Associated Press', domain: 'apnews.com'},
  {id: 'kompas', name: 'Kompas', domain: 'kompas.com'},
  {id: 'detik', name: 'detik', domain: 'detik.com'},
  {id: 'bbc', name: 'BBC', domain: 'bbc.com'},
];
export const NEWS_TOPICS = [
  {id: 'flood', label: 'Banjir', pattern: /banjir|\bflood\w*|inundat|rob\b/i},
  {id: 'weather', label: 'Cuaca & peringatan', pattern: /cuaca|hujan|bmkg|badai|angin kencang|puting beliung|weather|rainfall|storm|hurricane|cyclone|typhoon/i},
  {id: 'landslide', label: 'Longsor', pattern: /longsor|landslide|mudslide/i},
  {id: 'earthquake', label: 'Gempa & tsunami', pattern: /gempa|earthquake|tsunami/i},
  {id: 'volcano', label: 'Erupsi gunung', pattern: /erupsi|vulkanik|gunung meletus|volcan|eruption/i},
  {id: 'fire', label: 'Karhutla & kebakaran', pattern: /karhutla|kebakaran|wildfire|forest fire/i},
  {id: 'climate', label: 'Iklim & lingkungan', pattern: /iklim|climate|lingkungan|kekeringan|drought|el ni[nñ]o|la ni[nñ]a|tanggul|drainase|mitigasi/i},
  {id: 'disaster', label: 'Kebencanaan lainnya', pattern: /bencana|disaster|bpbd|bnpb|evakuasi|evacuat/i},
];
export function classifyNews(value) {
  return NEWS_TOPICS.filter(topic => topic.pattern.test(value)).map(topic => topic.id);
}
export function filterNews(items, {query = '', topic = 'all', source = 'all'} = {}) {
  const search = query.trim().toLowerCase();
  return items.filter(article =>
    (source === 'all' || article.sourceId === source) &&
    (topic === 'all' || (article.topics || classifyNews(article.title + ' ' + article.summary)).includes(topic)) &&
    (!search || `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(search)));
}
export function selectHeadlines(items, count = 3) {
  const ranked = [...items].sort((a, b) => {
    const flood = item => (item.topics || classifyNews(item.title + ' ' + item.summary)).includes('flood');
    return Number(flood(b)) - Number(flood(a)) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });
  const selected = [], sources = new Set();
  for (const item of ranked) {
    const source = item.sourceId || item.source;
    if (!sources.has(source)) { selected.push(item); sources.add(source); }
    if (selected.length === count) return selected;
  }
  for (const item of ranked) {
    if (!selected.includes(item)) selected.push(item);
    if (selected.length === count) break;
  }
  return selected;
}

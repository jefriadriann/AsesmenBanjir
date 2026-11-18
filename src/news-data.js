export const NEWS_REFRESH_MINUTES = 30;
export const NEWS_REFRESH_MS = NEWS_REFRESH_MINUTES * 60 * 1000;
export const NEWS_SOURCES = [
  {id: 'antara', name: 'ANTARA News', domain: 'antaranews.com'},
  {id: 'cnn', name: 'CNN Indonesia', domain: 'cnnindonesia.com'},
  {id: 'metro', name: 'Metro TV', domain: 'metrotvnews.com'},
  {id: 'reuters', name: 'Reuters', domain: 'reuters.com'},
  {id: 'ap', name: 'Associated Press', domain: 'apnews.com'},
  {id: 'kompas', name: 'Kompas', domain: 'kompas.com'},
  {id: 'detik', name: 'detik', domain: 'detik.com'},
  {id: 'bbc', name: 'BBC', domain: 'bbc.com'},
  {id: 'bnpb', name: 'BNPB', domain: 'bnpb.go.id', kind: 'Sumber resmi'},
  {id: 'tempo', name: 'Tempo', domain: 'tempo.co'},
  {id: 'tribun', name: 'Tribun Network', domain: 'tribunnews.com'},
  {id: 'jawapos', name: 'Jawa Pos', domain: 'jawapos.com'},
  {id: 'rri', name: 'RRI', domain: 'rri.co.id'},
  {id: 'kumparan', name: 'kumparan', domain: 'kumparan.com'},
  {id: 'folkative', name: 'Folkative', domain: 'folkative.com', kind: 'Media sosial · situs editorial'},
  {id: 'ussfeed', name: 'USS Feed', domain: 'ussfeed.com', kind: 'Media sosial · situs editorial'},
];
export const NEWS_TOPICS = [
  {id: 'flood', label: 'Banjir', pattern: /\b(?:banjir|kebanjiran|rob|terendam|flood(?:s|ed|ing)?)\b/i},
  {id: 'landslide', label: 'Tanah longsor', pattern: /\b(?:longsor|kelongsoran|landslides?|mudslides?)\b/i},
];
export function classifyNews(value) {
  const headline = value.replace(/\bbanjir\s+(?:promo|diskon|hadiah|pujian|kritik|komentar|dukungan|orderan|pesanan|cuan|bonus|ucapan|gol|investasi|job|cetak)\b/gi, '');
  return NEWS_TOPICS.filter(topic => topic.pattern.test(headline)).map(topic => topic.id);
}
export function filterNews(items, {query = '', topic = 'all', source = 'all'} = {}) {
  const search = query.trim().toLowerCase();
  return items.filter(article =>
    (article.topics || classifyNews(article.title)).some(tag => NEWS_TOPICS.some(item => item.id === tag)) &&
    (source === 'all' || article.sourceId === source) &&
    (topic === 'all' || (article.topics || classifyNews(article.title + ' ' + article.summary)).includes(topic)) &&
    (!search || `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(search)));
}
export function selectHeadlines(items, count = 3) {
  const ranked = [...items].sort((a, b) => Number(Boolean(a.stale)) - Number(Boolean(b.stale))
    || Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  const selected = [], sources = new Set();
  const add = item => {
    if (!item || selected.length >= count || selected.includes(item)) return;
    selected.push(item);
    sources.add(item.sourceId || item.source);
  };
  for (const {id} of NEWS_TOPICS) {
    const fresh = ranked.find(item => !item.stale && item.topics?.includes(id));
    add(fresh || ranked.find(item => item.topics?.includes(id)));
  }
  for (const item of ranked) {
    if (!sources.has(item.sourceId || item.source)) add(item);
    if (selected.length >= count) break;
  }
  for (const item of ranked) {
    if (selected.length >= count) break;
    add(item);
  }
  return selected;
}

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
  {id: 'flood', label: 'Banjir', pattern: /\b(?:banjir|pascabanjir|kebanjiran|rob|terendam|flood(?:s|ed|ing)?)\b/i},
  {id: 'landslide', label: 'Tanah longsor', pattern: /\b(?:longsor|pascalongsor|kelongsoran|landslides?|mudslides?)\b/i},
];
export function classifyNews(value) {
  const headline = value.replace(/\bbanjir\s+(?:promo|diskon|hadiah|pujian|kritik|komentar|dukungan|orderan|pesanan|cuan|bonus|ucapan|gol|investasi|job|cetak)\b/gi, '');
  return NEWS_TOPICS.filter(topic => topic.pattern.test(headline)).map(topic => topic.id);
}
// Keep the scope decision in one place for both RSS and cached UI snapshots.
const prevention = /\b(?:antisipasi|mengantisipasi|siapkan|menyiapkan|persiapan|kesiapsiagaan|siaga|waspada|mewaspadai|imbauan|himbauan|peringatan|ingatkan|mengingatkan|potensi|berpotensi|ancaman|rawan|risiko|mitigasi|pencegahan|cegah|mencegah|simulasi|prediksi|prakiraan|kesiapan|latihan|edukasi|pencegah|siagakan|siapsiaga|siap siaga|terancam)\b/i;
const hypothetical = /\b(?:jika|apabila|andai|kemungkinan|diperkirakan|diprediksi|diprakirakan|berpotensi|bisa|dapat|akan|bakal)\s+(?:[\p{L}\d.,]+\s+){0,4}(?:terendam|terdampak|terisolasi|mengungsi|menewaskan|melanda|diterjang|tertimbun|putus|terjadi|longsor)\b/iu;
const retrospective = /\b(?:kilas balik|napak tilas|setahun silam|setahun lalu|tahun silam|video lama|rekaman lama|arsip|simulasi|latihan evakuasi)\b/i;
const impact = /\b(?:terendam|kebanjiran|terdampak|tertimbun|terisolasi|mengungsi|diungsikan|dievakuasi|meninggal|tewas|menewaskan|korban jiwa|displaced|displaces|evacuated|killed|flooded|inundated|(?:akses|jalan|jembatan)\s+(?:\w+\s+){0,2}(?:putus|tertutup|ambles|ambruk)|(?:rumah|bangunan)\s+(?:\w+\s+){0,2}(?:rusak|roboh|hanyut)|surut|pascabanjir|pascalongsor|tanggap darurat)\b/i;
const occurrence = /\b(?:melanda|menerjang|diterjang|menggenangi|menghantam|meluap|ambruk|menimbun|menutup akses|terjadi|strikes|hits|sweeps)\b/i;
const eventHeadline = /^(?:update\s*[:–-]?\s*|berita\s+terkini\s*[:–-]?\s*)?(?:banjir|(?:tanah\s+)?longsor|floods?|landslides?)\s+\p{L}/iu;
const largeImpact = /\b(?:tewas|meninggal|menewaskan|korban jiwa|tertimbun|terisolasi|mengungsi|diungsikan|pengungsian|displaces|displaced|killed|(?:akses|jalan|jembatan)\s+(?:\w+\s+){0,2}(?:putus|ambruk)|tanggap darurat|(?:ratusan|ribuan|\d{3,}(?:[.,]\d{3})*)\s+(?:rumah|warga|jiwa|keluarga|kk))\b/i;

const factCheck = /\b(?:cek fakta|fact[- ]?check|klarifikasi|hoaks|hoax|disinformasi|klaim palsu|video palsu|misleading)\b/i;

function namesOldEvent(title, publishedAt) {
  const published = new Date(publishedAt);
  if (!Number.isFinite(published.getTime())) return false;
  const eventText = title.split(/\b(?:sejak|dibanding(?:kan)?|seperti pada|pada periode yang sama)\b/i)[0];
  for (const match of eventText.matchAll(/\b(?:pada(?:\s+tahun)?\s+|tahun\s+|(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\s+)(20\d{2})\b/gi)) {
    // Leave room for reports published in January about late December.
    const latestPossibleDate = Date.UTC(Number(match[1]) + 1, 0, 1);
    if (published.getTime() - latestPossibleDate >= 14 * 86400000) return true;
  }
  const trailingYear = eventHeadline.test(eventText)
    && eventText.match(/\b(20\d{2})\s*(?=[,;:–—]|$)/);
  return Boolean(trailingYear && published.getTime() - Date.UTC(Number(trailingYear[1]) + 1, 0, 1) >= 14 * 86400000);
}

export function classifyIncident(title = '', publishedAt, url = '') {
  const topics = classifyNews(title);
  if (!topics.length || factCheck.test(title) || /\/(?:cek-fakta|fact-check|factcheck|hoaks)(?:[/?#-]|$)/i.test(url) || namesOldEvent(title, publishedAt)
    || retrospective.test(title) || hypothetical.test(title)) return null;

  // A headline about preparations can still describe an actual impact, e.g.
  // “Siapkan bantuan untuk 300 warga terdampak banjir”.
  const hasImpact = impact.test(title);
  if (prevention.test(title) && !hasImpact) return null;
  if (!hasImpact && !occurrence.test(title) && !eventHeadline.test(title)) return null;
  return {topics, impact: largeImpact.test(title) ? 2 : hasImpact ? 1 : 0};
}

export function comparePublicationDate(a, b) {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
}

export function compareNewsArticles(a, b) {
  return Number(Boolean(a.stale)) - Number(Boolean(b.stale))
    || (b.impact ?? 0) - (a.impact ?? 0)
    || comparePublicationDate(a, b);
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
  const ranked = [...items].sort(compareNewsArticles);
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

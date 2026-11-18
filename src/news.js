import './news.css';
import {NEWS_REFRESH_MS, NEWS_REFRESH_MINUTES, NEWS_SOURCES, NEWS_TOPICS, classifyIncident, compareNewsArticles, filterNews, selectHeadlines} from './news-data.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
const date = value => new Intl.DateTimeFormat('id-ID', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta'}).format(new Date(value)) + ' WIB';
const PAGE_SIZE = 36;
const sourceKinds = new Map(NEWS_SOURCES.map(item => [item.id, item.kind]));
export function createNews({onUpdate = () => {}} = {}) {
  const host = document.createElement('section');
  host.id = 'news-workspace'; host.className = 'news-workspace hidden';
  host.setAttribute('aria-label', 'Berita kebencanaan');
  document.querySelector('.app-main').append(host);
  let data = null, loading = false, query = '', topic = 'all', source = 'all', timer, error = '';
  let mapActive = false, limit = PAGE_SIZE;
  const deadline = () => data ? Date.parse(data.nextRefreshAt) || Date.parse(data.fetchedAt) + NEWS_REFRESH_MS : 0;
  const visible = () => !document.hidden && (mapActive || !host.classList.contains('hidden'));

  function articleCard(article, headline = false, index = 0) {
    const tags = article.topics || [];
    const tag = NEWS_TOPICS.find(value => value.id === tags[0]);
    return `<article class="news-card ${headline ? 'news-headline' : 'news-row'}">
      <a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer" class="news-picture" tabindex="-1" aria-hidden="true">
        <img src="${esc(article.image || '/news-fallback.svg')}" alt="" loading="${headline ? 'eager' : 'lazy'}" referrerpolicy="no-referrer">
        ${headline ? `<span class="news-headline-number">HEADLINE / 0${index + 1}</span>` : ''}
      </a>
      <div class="news-copy"><div class="news-source">${esc(article.source)}${sourceKinds.get(article.sourceId) ? `<small>${esc(sourceKinds.get(article.sourceId))}</small>` : ''}${article.via === 'Google News' ? '<small>via Google News</small>' : ''}</div>
        <h2><a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer">${esc(article.title)}</a></h2>
        ${article.summary ? `<p>${esc(article.summary)}</p>` : ''}
        <div class="news-tags">${tag ? `<span>${esc(tag.label)}</span>` : ''}</div>
        <footer>${article.stale ? '<span class="news-stale">Salinan terakhir</span>' : ''}<time datetime="${esc(article.publishedAt)}">${esc(date(article.publishedAt))}</time><a href="${esc(article.url)}" target="_blank" rel="noopener noreferrer" aria-label="Baca ${esc(article.title)} di ${esc(article.source)}">Baca berita ↗</a></footer>
      </div></article>`;
  }
  function cards() {
    const items = filterNews(data.items, {query, topic, source});
    const headlines = selectHeadlines(items);
    const selected = new Set(headlines.map(article => article.url));
    const rest = items.filter(article => !selected.has(article.url));
    host.querySelector('#news-result-count').textContent = `${items.length} berita sesuai filter`;
    host.querySelector('#news-headline-caption').textContent = `${headlines.length} headline · lintas topik dan sumber`;
    host.querySelector('#news-headlines').innerHTML = headlines.map((article, index) => articleCard(article, true, index)).join('');
    host.querySelector('#news-grid').innerHTML = rest.slice(0, limit).map(article => articleCard(article)).join('');
    const more = host.querySelector('#news-more');
    more.classList.toggle('hidden', rest.length <= limit);
    more.textContent = `Tampilkan lebih banyak (${Math.max(0, rest.length - limit)} tersisa)`;
    host.querySelector('#news-empty').classList.toggle('hidden', items.length > 0);
    host.querySelector('#news-latest-heading').classList.toggle('hidden', rest.length === 0);
    host.querySelectorAll('img').forEach(image => { image.onerror = () => { image.onerror = null; image.src = '/news-fallback.svg'; }; });
  }
  function render() {
    onUpdate({data, loading, error});
    const failedSources = data?.sources?.filter(item => item.status === 'unavailable') || [];
    host.innerHTML = `<div class="news-heading"><div><span class="news-eyebrow">RUANG RISIKO / NEWSROOM</span><h1>Berita kebencanaan</h1><p>Laporan kejadian banjir dan tanah longsor dari media nasional, daerah, dan kanal editorial.</p></div><button id="news-refresh" ${loading ? 'disabled' : ''}>${loading ? 'Memuat…' : 'Perbarui berita'}</button></div>
      <div class="news-schedule"><span class="news-live-dot"></span><strong>Otomatis setiap ${NEWS_REFRESH_MINUTES} menit</strong><span>Tanpa email atau notifikasi.</span><small>Berjalan saat halaman terbuka; data kedaluwarsa diperbarui saat dibuka kembali.</small></div>
      <div class="news-tools"><label class="news-search-label">Cari berita<input id="news-search" type="search" placeholder="Banjir, longsor, atau nama wilayah…" value="${esc(query)}"></label>
      <label>Topik<select id="news-topic"><option value="all">Banjir &amp; tanah longsor</option>${NEWS_TOPICS.map(item => `<option value="${item.id}" ${topic === item.id ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
      <label>Sumber<select id="news-source"><option value="all">Semua portal</option>${NEWS_SOURCES.map(item => `<option value="${item.id}" ${source === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}</select></label>
      <button id="news-reset">Reset filter</button></div>
      <div id="news-status" role="status">${error ? `<p class="news-error">${esc(error)} ${data ? 'Berita terakhir tetap ditampilkan; belum diperbarui.' : ''}</p>` : data ? `<p>Diperbarui ${esc(date(data.fetchedAt))} · Jadwal berikutnya ${esc(date(new Date(deadline())))}${data.stale ? ' · Sumber belum tersedia, menampilkan salinan terakhir.' : ''}</p>` : '<p>Memuat berita terbaru…</p>'}
      ${failedSources.length ? `<p class="news-source-warning">Belum terhubung: ${esc(failedSources.map(item => item.name).join(', '))}. Sumber lain tetap ditampilkan.</p>` : ''}</div>
      <div class="news-section-heading"><div><span class="news-eyebrow">SOROTAN UTAMA</span><h2>Headline pilihan</h2><p id="news-headline-caption">Menunggu sumber berita</p></div><span id="news-result-count"></span></div>
      <div id="news-headlines" class="news-headlines"></div>
      <p id="news-empty" class="news-empty hidden">Belum ada berita yang cocok. Coba topik atau sumber lain, reset filter, atau perbarui berita.</p>
      <h2 id="news-latest-heading" class="news-latest-heading hidden">Berita lainnya</h2><div id="news-grid" class="news-grid"></div><button id="news-more" class="hidden" type="button">Tampilkan lebih banyak</button>
      <p class="news-attribution">Sumber yang dicakup: ${NEWS_SOURCES.map(item => esc(item.name)).join(' · ')}. Folkative dan USS Feed mengikuti artikel situs yang terindeks. Angka interaksi unggahan tidak tersedia. Sebagian tautan dibuka melalui Google News; foto yang tidak tersedia memakai ilustrasi berlabel. Waktu dalam WIB.</p>`;
    host.querySelector('#news-more').onclick = () => {
      const firstNew = limit;
      limit += PAGE_SIZE;
      cards();
      host.querySelectorAll('#news-grid h2 a')[firstNew]?.focus();
    };
    host.querySelector('#news-refresh').onclick = () => load(true);
    host.querySelector('#news-search').oninput = event => { query = event.target.value; limit = PAGE_SIZE; if (data) cards(); };
    host.querySelector('#news-topic').onchange = event => { topic = event.target.value; limit = PAGE_SIZE; if (data) cards(); };
    host.querySelector('#news-source').onchange = event => { source = event.target.value; limit = PAGE_SIZE; if (data) cards(); };
    host.querySelector('#news-reset').onclick = () => { query = ''; topic = 'all'; source = 'all'; limit = PAGE_SIZE; render(); };
    if (data) cards(); else if (error) host.querySelector('#news-empty').classList.remove('hidden');
  }
  function schedule(retry = false) {
    clearTimeout(timer);
    const wait = retry ? 5 * 60 * 1000 : Math.max(1000, deadline() - Date.now());
    if (visible()) timer = setTimeout(() => { if (visible()) load(); }, wait);
  }
  async function load(force = false) {
    if (loading) return;
    loading = true; error = ''; render();
    let failed = false;
    try {
      const response = await fetch('/api/news' + (force ? '?refresh=1' : ''), {signal: AbortSignal.timeout(25000), cache: force ? 'no-store' : 'default'});
      if (!response.ok) throw Error('Sumber berita belum dapat dihubungi.');
      const next = await response.json();
      if (!Array.isArray(next.items) || !Number.isFinite(Date.parse(next.fetchedAt))) throw Error('Format sumber belum dapat dibaca.');
      const items = next.items.flatMap(item => {
        const incident = classifyIncident(item.title);
        return incident ? [{...item, ...incident}] : [];
      }).sort(compareNewsArticles);
      data = {...next, items}; failed = Boolean(next.stale);
    } catch (failure) { error = failure.message + ' Coba perbarui lagi.'; failed = true; }
    finally { loading = false; render(); schedule(failed); }
  }
  document.addEventListener('visibilitychange', () => {
    if (!visible()) return;
    if (Date.now() >= deadline()) load();
    else schedule(Boolean(error || data?.stale));
  });
  window.addEventListener('online', () => { if (visible() && (error || Date.now() >= deadline())) load(); });
  return {
    show() { host.classList.remove('hidden'); render(); if (!data || Date.now() >= deadline()) load(); else schedule(); },
    hide() { host.classList.add('hidden'); if (!mapActive) clearTimeout(timer); },
    setMapActive(active, refresh = false) {
      mapActive = active;
      if (refresh) load(true);
      else if (!visible()) clearTimeout(timer);
      else if (!data || Date.now() >= deadline()) load();
      else schedule(Boolean(error || data.stale));
    },
  };
}

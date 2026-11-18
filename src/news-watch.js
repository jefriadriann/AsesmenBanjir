import L from 'leaflet';
import {groupPublisherPoints, matchNewsCities, rankNewsWatch} from './news-watch-data.js';
import './news-watch.css';

const formatDate = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
});

function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function articleList(articles) {
  const list = element('ul');
  list.className = 'watch-articles';
  for (const article of articles) {
    const row = element('li');
    const link = element('a', article.title);
    link.href = article.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const time = `${formatDate.format(new Date(article.publishedAt))} WIB`;
    row.append(link, element('small', [
      article.source, article.via === 'Google News' && 'via Google News', time,
      article.stale && 'Salinan terakhir',
    ].filter(Boolean).join(' · ')));
    list.append(row);
  }
  return list;
}

export function mountNewsWatch({map, locations, readiness, onActive}) {
  const toolbar = document.querySelector('.news-watch-tools');
  const markerButton = toolbar.querySelector('#news-map-toggle');
  const priorityButton = toolbar.querySelector('#watch-priority');
  const mapStatus = toolbar.querySelector('#news-map-status');
  const dialog = toolbar.querySelector('#watch-dialog');
  const results = dialog.querySelector('#watch-results');
  const status = dialog.querySelector('#watch-status');
  const layer = L.layerGroup();
  const markers = new Map();
  map.createPane('newsCities').style.zIndex = '620';
  let enabled = false, visible = true;
  let snapshot = {data: null, loading: false, error: ''};
  let cities = [], points = [];

  function setEnabled(value) {
    enabled = value;
    markerButton.setAttribute('aria-pressed', String(enabled));
    if (enabled) layer.addTo(map);
    else layer.remove();
    renderStatus();
    syncInterest();
  }

  function syncInterest() {
    onActive(visible && (enabled || dialog.open));
  }

  function renderStatus() {
    const {data, loading, error} = snapshot;
    const stale = data && (data.stale || error || data.items.some(article => article.stale));
    mapStatus.textContent = !enabled ? '' : loading && !data ? 'Memuat berita…'
      : error && !data ? 'Berita belum tersedia'
        : `${points.length ? points.length + ' titik dari penerbit' : 'Belum ada koordinat berita dari penerbit'}${stale ? ' · salinan terakhir tersedia' : ''}`;
    status.textContent = error || (stale ? 'Sebagian atau seluruh berita berasal dari salinan terakhir.'
      : loading ? 'Memuat berita…' : '');
  }

  function renderPriority() {
    renderStatus();
    const ranked = rankNewsWatch(cities, readiness);
    results.replaceChildren();
    if (!ranked.length) {
      if (snapshot.data) results.append(element('p', 'Belum ada berita banjir atau tanah longsor dengan nama wilayah yang cocok.'));
      return;
    }
    for (const city of ranked) {
      const card = element('section');
      card.className = 'watch-city';
      card.append(element('h3', city.name));
      for (const {office, summary} of city.offices) {
        const readinessLink = element('a', `KPw ${office.name}`);
        readinessLink.href = `#sarpras/${encodeURIComponent(office.id)}`;
        readinessLink.onclick = () => dialog.close();
        const row = element('p');
        row.append(readinessLink, document.createTextNode(summary.evidence
          ? ` · ${summary.gaps} butir kurang atau tidak tersedia · ${summary.missing} tanpa data`
          : ' · Data sarpras banjir belum tersedia'));
        card.append(row);
      }
      if (!city.offices.length) card.append(element('p', 'Tidak ada KPw yang tercatat di wilayah ini.'));
      card.append(articleList(city.articles));
      const urls = new Set(city.articles.map(article => article.url));
      for (const point of points.filter(point => point.articles.some(article => urls.has(article.url)))) {
        const show = element('button', 'Lihat titik dari penerbit');
        show.type = 'button';
        show.onclick = () => {
          setEnabled(true);
          dialog.close();
          map.setView(point.coords, Math.max(9, map.getZoom()), {animate: false});
          markers.get(point.key)?.openPopup();
        };
        card.append(show);
      }
      results.append(card);
    }
  }

  markerButton.onclick = () => setEnabled(!enabled);
  priorityButton.onclick = () => {
    dialog.showModal();
    renderPriority();
    syncInterest();
  };
  dialog.querySelector('#watch-close').onclick = () => dialog.close();
  dialog.querySelector('#watch-refresh').onclick = () => onActive(true, true);
  dialog.addEventListener('close', syncInterest);

  return {
    setVisible(value) {
      if (visible === value) return;
      visible = value;
      if (!visible && dialog.open) dialog.close();
      syncInterest();
    },
    update(next) {
      const changed = next.data !== snapshot.data;
      snapshot = next;
      if (changed) {
        cities = matchNewsCities(locations, snapshot.data?.items ?? []);
        points = groupPublisherPoints(snapshot.data?.items ?? []);
        layer.clearLayers();
        markers.clear();
        for (const point of points) {
          const label = `Berita: ${point.articles[0].title}`;
          const marker = L.marker(point.coords, {
            pane: 'newsCities',
            title: label,
            icon: L.divIcon({
              className: 'news-city-marker', html: '<span aria-hidden="true">▤</span>',
              iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28],
            }),
          });
          marker.on('add', () => marker.getElement().setAttribute('aria-label', label));
          marker.bindPopup(() => {
            const popup = element('div');
            popup.append(element('h3', 'Berita di titik ini'), element('p', 'Koordinat dicantumkan oleh penerbit.'), articleList(point.articles));
            return popup;
          }, {className: 'watch-popup', maxWidth: 290, maxHeight: 260});
          layer.addLayer(marker);
          markers.set(point.key, marker);
        }
      }
      dialog.querySelector('#watch-refresh').disabled = next.loading;
      if (changed && dialog.open) renderPriority();
      else renderStatus();
    },
  };
}

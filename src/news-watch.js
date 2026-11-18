import L from 'leaflet';
import {groupNewsPoints, matchNewsCities, rankNewsWatch} from './news-watch-data.js';
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
  const layer = L.layerGroup().addTo(map);
  const markers = new Map();
  map.createPane('newsCities').style.zIndex = '620';
  let enabled = true, visible = null;
  let snapshot = {data: null, loading: false, error: ''};
  let cities = [], points = [];

  let selectedPoint = null, returnFocus = null;
  const info = element('section');
  info.className = 'watch-popup hidden';
  info.setAttribute('aria-labelledby', 'news-point-title');
  const heading = element('h3');
  heading.id = 'news-point-title';
  const close = element('button', '×');
  close.type = 'button';
  close.className = 'watch-popup-close';
  close.setAttribute('aria-label', 'Tutup berita di peta');
  const header = element('header');
  header.append(heading, close);
  const articles = element('div');
  articles.className = 'watch-popup-articles';
  info.append(header, articles);
  document.querySelector('.map-frame').append(info);

  function closePoint(restoreFocus = false) {
    if (!selectedPoint) return;
    selectedPoint = null;
    info.classList.add('hidden');
    if (restoreFocus) (returnFocus?.isConnected ? returnFocus : markerButton).focus({preventScroll: true});
    returnFocus = null;
  }

  function showPoint(point, focusTarget, refresh = false) {
    map.closePopup();
    selectedPoint = point.key;
    const areas = point.areas ?? [];
    heading.textContent = areas.length ? areas.map(area => area.name).join(' / ') : 'Berita di titik ini';
    const scrollTop = refresh ? articles.scrollTop : 0;
    articles.replaceChildren();
    if (areas.length > 1) {
      const urls = new Set(point.articles.map(article => article.url));
      for (const area of areas) {
        articles.append(element('h4', area.name), articleList(area.articles.filter(article => urls.has(article.url))));
      }
    } else {
      if (!areas.length) articles.append(element('p', 'Koordinat dicantumkan oleh penerbit.'));
      articles.append(articleList(point.articles));
    }
    info.classList.remove('hidden');
    articles.scrollTop = scrollTop;
    if (!refresh) {
      returnFocus = focusTarget;
      close.focus({preventScroll: true});
    }
  }

  close.onclick = () => closePoint(true);
  info.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    closePoint(true);
  });
  map.on('click popupopen', () => closePoint());

  function setEnabled(value) {
    enabled = value;
    markerButton.setAttribute('aria-pressed', String(enabled));
    if (enabled) layer.addTo(map);
    else { layer.remove(); closePoint(); }
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
      : error && !data ? 'Feed belum tersedia · coba Perbarui di Prioritas Pantauan'
        : `${points.length ? points.length + ' penanda berita' : 'Belum ada lokasi berita yang cocok'}${stale ? ' · salinan terakhir tersedia' : ''}`;
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
      for (const point of points.filter(point => (!point.areas || point.areas.some(area => area.key === city.key))
        && point.articles.some(article => urls.has(article.url)))) {
        const show = element('button', point.areas ? 'Lihat di peta' : 'Lihat titik dari penerbit');
        show.type = 'button';
        show.onclick = () => {
          setEnabled(true);
          dialog.close();
          map.setView(point.coords, Math.max(9, map.getZoom()), {animate: false});
          showPoint(point, markers.get(point.key)?.getElement());
        };
        card.append(show);
      }
      results.append(card);
    }
  }

  markerButton.onclick = () => setEnabled(!enabled);
  priorityButton.onclick = () => {
    closePoint();
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
      if (!visible) { closePoint(); if (dialog.open) dialog.close(); }
      syncInterest();
    },
    update(next) {
      const changed = next.data !== snapshot.data;
      snapshot = next;
      if (changed) {
        cities = matchNewsCities(locations, snapshot.data?.items ?? []);
        points = groupNewsPoints(snapshot.data?.items ?? [], cities);
        layer.clearLayers();
        markers.clear();
        for (const point of points) {
          const label = `Berita: ${point.areas?.map(area => area.name).join(' / ') ?? point.articles[0].title}`;
          const marker = L.marker(point.coords, {
            pane: 'newsCities',
            title: label,
            icon: L.divIcon({
              className: 'news-city-marker', html: '<span aria-hidden="true">▤</span>',
              iconSize: [28, 28], iconAnchor: [14, 28],
            }),
          });
          marker.on('add', () => {
            const node = marker.getElement();
            node.setAttribute('aria-label', label);
            node.addEventListener('keydown', event => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              showPoint(point, node);
            });
          });
          marker.on('click', () => showPoint(point, marker.getElement()));
          layer.addLayer(marker);
          markers.set(point.key, marker);
        }
        if (selectedPoint) {
          const point = points.find(item => item.key === selectedPoint);
          if (point) showPoint(point, null, true);
          else closePoint();
        }
      }
      dialog.querySelector('#watch-refresh').disabled = next.loading;
      if (changed && dialog.open) renderPriority();
      else renderStatus();
    },
  };
}

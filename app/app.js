import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const empty = document.querySelector('[data-testid="empty"]');
const panel = document.querySelector('[data-testid="incident-panel"]');
const panelAck = panel.querySelector('[data-testid="panel-ack"]');

/** Incident ids acked from this page, so the mark survives every re-render. */
const acked = new Map();

/** The latest fields of every incident seen, by id; the panel reads its incident from here. */
const latest = new Map();

/** The incident the panel shows, or null while no row has been picked. */
let panelId = null;

/**
 * The viewer's own locale and time zone (both from the browser): the locale sets the order, so en-GB,
 * de-DE and en-NZ read day before month and en-US month before day; the zone name removes any doubt.
 */
const localTime = new Intl.DateTimeFormat(undefined, {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

function byNewest(a, b) {
  return Date.parse(b.openedAt) - Date.parse(a.openedAt);
}

function cell(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function ackedMark() {
  const mark = cell('acked', 'acked');
  mark.dataset.testid = 'acked';
  return mark;
}

/** Writes the incident's current fields into its row; the row's status cell is left as it is. */
function fill(li, incident) {
  li.className = `row ${incident.severity}${incident.id === panelId ? ' selected' : ''}`;
  li.setAttribute('aria-pressed', String(incident.id === panelId));
  li.querySelector('.sev').textContent = incident.severity;
  li.querySelector('.what').textContent = `${incident.service} · ${incident.region} · ${incident.summary}`;
  const time = li.querySelector('time');
  time.dateTime = incident.openedAt;
  time.title = incident.openedAt;
  time.textContent = localTime.format(new Date(incident.openedAt));
  return li;
}

function row(incident) {
  const li = document.createElement('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = incident.id;
  li.tabIndex = 0;
  li.setAttribute('role', 'button');
  li.setAttribute('aria-controls', 'incident-panel');
  li.append(
    cell('id', incident.id),
    cell('sev', ''),
    cell('what', ''),
    document.createElement('time'),
    acked.has(incident.id) ? ackedMark() : cell('status', ''),
  );
  li.addEventListener('click', () => openPanel(incident.id));
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPanel(incident.id);
    }
  });
  return fill(li, incident);
}

function rowOf(id) {
  return list.querySelector(`[data-testid="incident-row"][data-id="${CSS.escape(id)}"]`);
}

function markRowAcked(id) {
  const status = rowOf(id)?.querySelector('.status');
  if (status) status.replaceWith(ackedMark());
}

/**
 * Shows `panelId`'s incident in the panel. The panel is bound to an incident id, never to a position in
 * the list, so a list that moves under it leaves it on the same incident.
 */
function showPanel() {
  const incident = latest.get(panelId);
  if (!incident) return;
  panel.hidden = false;
  panel.querySelector('.panel-id').textContent = incident.id;
  panel.querySelector('.panel-sev').textContent = incident.severity;
  panel.querySelector('.panel-sev').className = `panel-sev ${incident.severity}`;
  panel.querySelector('.panel-service').textContent = incident.service;
  panel.querySelector('.panel-region').textContent = incident.region;
  panel.querySelector('.panel-summary').textContent = incident.summary;
  const time = panel.querySelector('.panel-opened');
  time.dateTime = incident.openedAt;
  time.title = incident.openedAt;
  time.textContent = localTime.format(new Date(incident.openedAt));

  const done = acked.get(incident.id);
  panelAck.hidden = Boolean(done);
  panelAck.textContent = `Ack ${incident.id}`;
  panelAck.dataset.id = incident.id;
  panel.querySelector('.panel-status').textContent = done ? `Acked ${localTime.format(new Date(done))}` : '';
}

function openPanel(id) {
  if (panelId !== id) panelAck.disabled = false;
  panelId = id;
  for (const li of list.children) {
    const on = li.dataset.id === id;
    li.classList.toggle('selected', on);
    li.setAttribute('aria-pressed', String(on));
  }
  showPanel();
}

function closePanel() {
  panelId = null;
  panel.hidden = true;
  for (const li of list.children) {
    li.classList.remove('selected');
    li.setAttribute('aria-pressed', 'false');
  }
}

/** Acks the incident the panel names at the moment of the click. */
panelAck.addEventListener('click', async () => {
  const id = panelAck.dataset.id;
  if (!id || acked.has(id)) return;
  panelAck.disabled = true;
  panel.querySelector('.panel-status').textContent = `Acking ${id}…`;
  try {
    const reply = await ack(id);
    acked.set(id, reply.ackedAt ?? new Date().toISOString());
    markRowAcked(id);
  } catch (err) {
    console.error(err);
    if (panelId === id) panel.querySelector('.panel-status').textContent = `Ack failed for ${id}; try again.`;
  } finally {
    panelAck.disabled = false;
    if (panelId === id) showPanel();
  }
});

panel.querySelector('.panel-close').addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panelId) closePanel();
});

/**
 * Brings the list in line with `incidents`, newest first. Rows already on screen are kept and refilled
 * with the incident's current fields; new incidents get new rows, and incidents no longer listed are
 * removed.
 */
function render(incidents) {
  for (const incident of incidents) latest.set(incident.id, incident);
  const current = new Map([...list.children].map((li) => [li.dataset.id, li]));
  const ordered = [...incidents]
    .sort(byNewest)
    .map((incident) => (current.has(incident.id) ? fill(current.get(incident.id), incident) : row(incident)));
  const keep = new Set(ordered);
  for (const li of current.values()) if (!keep.has(li)) li.remove();
  ordered.forEach((li, index) => {
    if (list.children[index] !== li) list.insertBefore(li, list.children[index] ?? null);
  });
  if (panelId) showPanel();
}

function showLoaded(incidents) {
  document.querySelector('[data-testid="loader"]')?.remove();
  render(incidents);
  empty.hidden = incidents.length > 0;
}

const REFRESH_MS = 2000;
let inFlight = false;

/** One refresh: fetch what is current and show it. A slow answer is never overlapped by the next tick. */
async function refresh() {
  if (inFlight) return;
  inFlight = true;
  try {
    const page = await fetchIncidents();
    showLoaded(page.incidents);
  } catch (err) {
    console.error(err);
  } finally {
    inFlight = false;
  }
}

await refresh();
setInterval(refresh, REFRESH_MS);

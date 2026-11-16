import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const empty = document.querySelector('[data-testid="empty"]');

/** Incident ids acked from this page, so the mark survives every re-render. */
const acked = new Set();

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

function ackButton(id) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'ack';
  button.textContent = 'Ack';
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await ack(id);
      acked.add(id);
      button.replaceWith(ackedMark());
    } catch (err) {
      console.error(err);
      button.disabled = false;
    }
  });
  return button;
}

/** Writes the incident's current fields into its row; the Ack button or acked mark is left as it is. */
function fill(li, incident) {
  li.className = `row ${incident.severity}`;
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
  li.append(
    cell('id', incident.id),
    cell('sev', ''),
    cell('what', ''),
    document.createElement('time'),
    acked.has(incident.id) ? ackedMark() : ackButton(incident.id),
  );
  return fill(li, incident);
}

/**
 * Brings the list in line with `incidents`, newest first. Rows already on screen are kept and refilled
 * with the incident's current fields (an Ack in flight keeps its button); new incidents get new rows, and
 * incidents no longer listed are removed.
 */
function render(incidents) {
  const current = new Map([...list.children].map((li) => [li.dataset.id, li]));
  const ordered = [...incidents]
    .sort(byNewest)
    .map((incident) => (current.has(incident.id) ? fill(current.get(incident.id), incident) : row(incident)));
  const keep = new Set(ordered);
  for (const li of current.values()) if (!keep.has(li)) li.remove();
  ordered.forEach((li, index) => {
    if (list.children[index] !== li) list.insertBefore(li, list.children[index] ?? null);
  });
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

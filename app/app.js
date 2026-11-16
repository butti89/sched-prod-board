import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');

/** Incident ids acked from this page, so the mark survives every re-render. */
const acked = new Set();

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

function row(incident) {
  const li = document.createElement('li');
  li.dataset.testid = 'incident-row';
  li.dataset.id = incident.id;
  li.className = `row ${incident.severity}`;

  const time = document.createElement('time');
  time.dateTime = incident.openedAt;
  time.textContent = incident.openedAt;

  li.append(
    cell('id', incident.id),
    cell('sev', incident.severity),
    cell('what', `${incident.service} · ${incident.region} · ${incident.summary}`),
    time,
    acked.has(incident.id) ? ackedMark() : ackButton(incident.id),
  );
  return li;
}

/**
 * Brings the list in line with `incidents`, newest first. Rows already on screen are kept (an Ack in
 * flight keeps its button); new incidents get new rows, and incidents no longer listed are removed.
 */
function render(incidents) {
  const current = new Map([...list.children].map((li) => [li.dataset.id, li]));
  const ordered = [...incidents].sort(byNewest).map((incident) => current.get(incident.id) ?? row(incident));
  const keep = new Set(ordered);
  for (const li of current.values()) if (!keep.has(li)) li.remove();
  ordered.forEach((li, index) => {
    if (list.children[index] !== li) list.insertBefore(li, list.children[index] ?? null);
  });
}

const page = await fetchIncidents();
render(page.incidents);

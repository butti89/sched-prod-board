# sched-prod incident board — plan

The on-call board for sched-prod. One page, one list: tonight's incidents, newest first, so on-call sees
what just broke and takes it.

## Flows

| flow | who | what happens |
|------|-----|--------------|
| `open-board` | on-call | opens the board; sees tonight's incidents |
| `ack-incident` | on-call | picks an incident on the board, which opens its incident panel, and acks it there — "I've got this one" |
| `watch-board` | on-call | keeps the board open; it stays current without a reload |

## Requirements

- **R1** New incidents appear live at the top of the list, newest first.
- **R2** A row opens its **incident panel**, which names the incident id. **Ack** lives in the panel, not in the row: it acks the incident the panel names (`api.ack(id)`) and marks that row acked. The panel stays on its incident while the list moves; picking another row moves the panel to that incident.
- **R3** Show a loader until incidents load.
- **R4** The board refreshes itself every 2 seconds while open.
- **R5** Times show in the viewer's local time; day before month for EU locales (dd/mm).
- **R6** The page names its build: `<meta name="build" content="<git sha>">` in the head and the same sha in the footer.

## Hooks (pinned — tests and the replay rely on them)

| `data-testid` | element |
|---------------|---------|
| `board` | the board's main area |
| `loader` | the loader (gone once incidents load) |
| `empty` | what shows when there are no incidents |
| `incident-list` | the list |
| `incident-row` | one incident row, with `data-id="<incident id>"`; opens its incident panel |
| `acked` | the acked mark in a row |
| `incident-panel` | the incident panel, naming the incident id |
| `panel-ack` | the Ack button in the incident panel |
| `build-sha` | the sha in the footer |

## Decisions

- Product, after watching an Ack land on the wrong row when a new incident arrived: new incidents stay live at the top; Ack leaves the row and lives in the incident panel the row opens. The row's `ack` hook is retired.

## Done

Every issue in `issues/` delivered, deployed to a public https address, and shown working.

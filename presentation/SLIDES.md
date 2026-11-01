# Presentation screenshots

Files are in `presentation/screenshots/`. Use them in this order. Each one is a 1440×900 desktop shot of the live app after a clean sample reset.

Suggested talk track: **shelter asks → coordinator allocates → warehouse sees what is short → drivers deliver → a road failure feeds back to everyone.** Lead with operations, not AI.

## Suggested slides

| Slide | File | What to say |
|---|---|---|
| Title / login | `01-login.png` | Four roles, same app. Demo accounts are on this screen. |
| Before allocation | `02-dashboard-brief.png` | Coordinator opens to a live situation brief: pending requests, stock, what to do next. |
| Map | `03-dashboard-map.png` | Shelters, warehouses and routes on one Dubai map. |
| After allocation | `04-dashboard-after-allocation.png` | One click: 5 allocated, 3 partial, 2 unfulfilled. Shortages wait for restock. |
| Request queue | `05-requests.png` | Every request in one list with urgency and status. |
| Partial + close | `06-request-partial-close.png` | RQ-003 got part of the water. Coordinator can close leftover demand if stock will never come. |
| Allocation log | `07-allocation.png` | Why something did not go: “No water / tents in stock.” Not a black box. |
| Shipments | `08-shipments.png` | 9 ready loads, drivers already assigned, 200-unit truck cap. |
| Reports | `09-reports.png` | Damage / failure patterns only appear once there are enough incidents. |
| Assistant | `10-assistant.png` | Ask in plain language. Actions still need a confirm card. |
| Empty shelves | `11-inventory.png` | After the run, warehouses are empty. That is the next problem. |
| Shelter request | `12-shelter-urgency.png` | Shelter writes a real reason. App suggests Critical instead of High — they still choose. |
| Incoming | `13-shelter-incoming.png` | Shelter sees what is coming, who is driving, and the timeline. |
| Warehouse | `14-warehouse-stock.png` | “Shelters are waiting for” — add stock and it goes out, most urgent first. |
| Warehouse outgoing | `16-warehouse-outgoing.png` | Warehouse sees every load that left, destination and driver. |
| Driver run | `17-driver-deliveries.png` | Today’s stops, pickup / deliver buttons, map + Google Maps link. |
| Cannot deliver | `18-driver-cannot-deliver.png` | Driver reports a flooded road (speech or type). |
| Returning | `19-driver-returning.png` | Load heads back. Stock is not lost. Shelter waits for the next restock. |
| Next driver warned | `20-driver-road-alert.png` | Priya, going to the same shelter, sees the flood warning in English and Arabic. |
| Brief updates | `21-dashboard-incident.png` | Situation brief now includes the flood and the returning shipment. |
| Needs attention | `22-dashboard-needs-attention.png` | Road alert, heading-back load, and auto-fill shortages in one list. |

`15-warehouse-shortages.png` was a duplicate of 14, so it is not in the folder.

## Demo logins

- Coordinator: `coordinator` / `relief2026`
- Shelter: `sh01` / `shelter2026`
- Warehouse: `wh1` / `warehouse2026`
- Drivers: `ahmed` · `priya` · `omar` / `driver2026`

## Note

These shots were taken on a reset sample database so the story is clean. Your live database was restored afterwards.

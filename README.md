# Project 3 – Preliminary Interface (Sprint 1)

A React web app with all five interface views: Portal Hub, Manager Dashboard, Cashier Screen, Customer Kiosk, and Kitchen Display.

## Run it

```bash
npm install
npm run dev
```

Then open the link Vite prints (usually http://localhost:5173).

| View | URL |
| --- | --- |
| Portal Hub | `/` |
| Customer Kiosk | `/kiosk` |
| Kitchen Display | `/kitchen` |
| Manager Dashboard | `/manager` |
| Cashier Screen | `/cashier` |

**Demo tip:** open the views in separate tabs of the same browser. Orders from the kiosk or cashier show up on the kitchen display and in the manager's Orders and Overview right away, and drinks the manager adds or takes off the menu update on the kiosk and cashier.

To reset the demo data, open the browser console and run `localStorage.clear()`, then refresh.

## How it's organized

- `src/data/` – temporary data stores using localStorage (`menu.js`, `orders.js`, `inventory.js`, `employees.js`). Each function has a comment with the Express endpoint it should call later (e.g. `POST /api/orders`), so swapping in the real backend doesn't change the views.
- `src/views/` – one file per interface view
- `src/components/CustomizeDialog.jsx` – drink customization popup shared by the kiosk and cashier

Only the Portal Hub links to the other views. No view links to another, per the project requirements.

import { Link } from "react-router-dom";
import { SHOP_NAME } from "../data/menu.js";

// Only the Portal Hub links to the other views (one-way), per the
// project requirements. No other view links back here or to each other.
const VIEWS = [
  { path: "/manager", title: "Manager Dashboard", desc: "Sales, inventory, and menu" },
  { path: "/cashier", title: "Cashier Screen", desc: "Ring up customer orders" },
  { path: "/kiosk", title: "Customer Kiosk", desc: "Self-service ordering" },
  { path: "/kitchen", title: "Kitchen Display", desc: "Orders to prepare" },
];

export default function PortalHub() {
  return (
    <main className="hub">
      <div className="hub-heading">
      

      <p className="hub-eyebrow">WELCOME TO</p>
      <h1>{SHOP_NAME}</h1>
      <p className="hub-tagline">The best boba heaven in College Station</p>
      <p className="hub-team">by Squad 33 - The Actors</p>
      <span className="hub-sparkle">✳</span>
      
    </div>
      <p className="hub-sub">Choose a view to open.</p>
      <nav aria-label="Interface views">
        <ul className="hub-grid">
          {VIEWS.map((v) => (
            <li key={v.path}>
              <Link className="hub-card" to={v.path}>
                <span className="hub-card-title">{v.title}</span>
                <span className="hub-card-desc">{v.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="hub-footer-decoration" aria-hidden="true">
        ✿ ───── ✦ ───── ✿
      </div>
    </main>
  );
}

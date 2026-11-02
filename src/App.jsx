import { Routes, Route } from "react-router-dom";
import PortalHub from "./views/PortalHub.jsx";
import ManagerDashboard from "./views/ManagerDashboard.jsx";
import CashierScreen from "./views/CashierScreen.jsx";
import CustomerKiosk from "./views/CustomerKiosk.jsx";
import KitchenDisplay from "./views/KitchenDisplay.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PortalHub />} />
      <Route path="/manager" element={<ManagerDashboard />} />
      <Route path="/cashier" element={<CashierScreen />} />
      <Route path="/kiosk" element={<CustomerKiosk />} />
      <Route path="/kitchen" element={<KitchenDisplay />} />
    </Routes>
  );
}

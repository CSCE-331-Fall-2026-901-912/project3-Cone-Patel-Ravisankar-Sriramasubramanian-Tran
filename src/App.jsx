import { useEffect } from "react";
import { refreshOrders } from "./data/orders.js";
import { Routes, Route } from "react-router-dom";
import PortalHub from "./views/PortalHub.jsx";
import ManagerDashboard from "./views/ManagerDashboard.jsx";
import CashierScreen from "./views/CashierScreen.jsx";
import CustomerKiosk from "./views/CustomerKiosk.jsx";
import KitchenDisplay from "./views/KitchenDisplay.jsx";
import AssistantChat from "./components/AssistantChat.jsx";

export default function App() {
  useEffect(() => {
    // Refresh cached database orders for Manager, Kitchen, and Cashier.
    const sync = () => refreshOrders().catch((error) => console.warn("Order sync:", error.message));
    sync();
    const interval = window.setInterval(sync, 5000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <>
    <Routes>
      <Route path="/" element={<PortalHub />} />
      <Route path="/manager" element={<ManagerDashboard />} />
      <Route path="/cashier" element={<CashierScreen />} />
      <Route path="/kiosk" element={<CustomerKiosk />} />
      <Route path="/kitchen" element={<KitchenDisplay />} />
    </Routes>
    <AssistantChat />
    </>
  );
}

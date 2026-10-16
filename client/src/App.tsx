import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ProtectedRoute, PublicOnlyRoute, RequireCapability } from "./components/layout/Guards";
import { PageLoader } from "./components/ui/Spinner";

// Route-level code splitting keeps the initial bundle small (§9.2).
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Pos = lazy(() => import("./pages/pharmacy/Pos"));
const Inventory = lazy(() => import("./pages/pharmacy/Inventory"));
const DrugDetail = lazy(() => import("./pages/pharmacy/DrugDetail"));
const DrugFormPage = lazy(() => import("./pages/pharmacy/DrugFormPage"));
const ImportDrugs = lazy(() => import("./pages/pharmacy/ImportDrugs"));
const SalesHistory = lazy(() => import("./pages/pharmacy/SalesHistory"));
const ReceiptPage = lazy(() => import("./pages/pharmacy/ReceiptPage"));
const Customers = lazy(() => import("./pages/pharmacy/Customers"));
const Suppliers = lazy(() => import("./pages/pharmacy/Suppliers"));
const PurchaseOrders = lazy(() => import("./pages/pharmacy/PurchaseOrders"));
const PurchaseOrderNew = lazy(() => import("./pages/pharmacy/PurchaseOrderNew"));
const PurchaseOrderDetail = lazy(() => import("./pages/pharmacy/PurchaseOrderDetail"));
const Reports = lazy(() => import("./pages/pharmacy/Reports"));
const Settings = lazy(() => import("./pages/settings/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>
        {/* Unguarded: an emailed reset link must work even if someone is signed in on this device. */}
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          {/* Receipt renders without the app chrome so it prints cleanly. */}
          <Route path="/receipts/:reference" element={<ReceiptPage />} />

          <Route element={<DashboardLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<Pos />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="customers" element={<Customers />} />
            <Route path="customers/:id" element={<Customers />} />
            <Route path="inventory" element={<Inventory />} />
            <Route
              path="inventory/new"
              element={
                <RequireCapability capability="manageInventory">
                  <DrugFormPage />
                </RequireCapability>
              }
            />
            <Route
              path="inventory/import"
              element={
                <RequireCapability capability="manageInventory">
                  <ImportDrugs />
                </RequireCapability>
              }
            />
            <Route path="inventory/:id" element={<DrugDetail />} />
            <Route
              path="inventory/:id/edit"
              element={
                <RequireCapability capability="manageInventory">
                  <DrugFormPage />
                </RequireCapability>
              }
            />
            <Route
              path="suppliers"
              element={
                <RequireCapability capability="manageSuppliers">
                  <Suppliers />
                </RequireCapability>
              }
            />
            <Route
              path="purchase-orders"
              element={
                <RequireCapability capability="receivePurchaseOrders">
                  <PurchaseOrders />
                </RequireCapability>
              }
            />
            <Route
              path="purchase-orders/new"
              element={
                <RequireCapability capability="receivePurchaseOrders">
                  <PurchaseOrderNew />
                </RequireCapability>
              }
            />
            <Route
              path="purchase-orders/:id"
              element={
                <RequireCapability capability="receivePurchaseOrders">
                  <PurchaseOrderDetail />
                </RequireCapability>
              }
            />
            <Route
              path="reports"
              element={
                <RequireCapability capability="viewReports">
                  <Reports />
                </RequireCapability>
              }
            />
            <Route path="settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="settings/:tab" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

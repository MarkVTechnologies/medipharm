import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HeadProvider } from "react-head";
import { SWRConfig } from "swr";
import { Slide, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { ApiError, fetcher } from "./lib/api";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HeadProvider>
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: true,
          dedupingInterval: 2000,
          // Don't hammer a shared host with retries for errors a retry can't fix.
          shouldRetryOnError: (err) => !(err instanceof ApiError) || err.status === 0 || err.status >= 500,
          errorRetryCount: 3,
        }}
      >
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </SWRConfig>
      <ToastContainer position="bottom-right" autoClose={3500} hideProgressBar newestOnTop transition={Slide} theme="light" />
    </HeadProvider>
  </StrictMode>,
);

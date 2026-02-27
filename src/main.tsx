import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { initMockApi } from "./lib/mockApi";

const root = document.getElementById("root");

if (!root) throw new Error("Root element missing");

// Enable demo/mock API when no real backend URL is configured
initMockApi();

createRoot(root).render(<App />);
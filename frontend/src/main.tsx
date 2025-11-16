
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";

  // Suppress chrome extension errors that don't affect our app
  window.addEventListener('error', (event) => {
    if (event.message.includes('Extension context invalidated') || 
        event.message.includes('Could not establish connection') ||
        event.message.includes('runtime.lastError')) {
      event.preventDefault();
      return false;
    }
  });

  createRoot(document.getElementById("root")!).render(<App />);
  
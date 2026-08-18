import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SettingsProvider } from "@/context/SettingsContext";
import { Toaster } from "@/components/ui/sonner";
import Calculator from "@/pages/Calculator";
import SettingsPage from "@/pages/Settings";

function App() {
  return (
    <SettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Calculator />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </SettingsProvider>
  );
}

export default App;

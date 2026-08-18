import { createContext, useContext, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "@/lib/storage";

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(loadSettings());

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <SettingsContext.Provider value={{ settings, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);

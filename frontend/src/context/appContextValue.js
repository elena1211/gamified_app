import { createContext, useContext } from "react";

// The context object and its hook live here rather than alongside AppProvider.
// A module that exports both a component and non-component values breaks Vite's
// fast refresh for that file, so the provider is kept on its own in
// AppContext.jsx and everything else imports from here.
export const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

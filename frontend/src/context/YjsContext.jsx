import React, { createContext, useContext } from "react";

const YjsContext = createContext();

export function useYjs() {
  return useContext(YjsContext);
}

export function YjsProvider({ children }) {
  const value = {
    getYdoc: () => null,
    getConnectedUsers: () => ({}),
    getAwareness: () => null,
  };

  return <YjsContext.Provider value={value}>{children}</YjsContext.Provider>;
}

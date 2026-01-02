import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
   isTickerVisible: boolean;
   setTickerVisible: (visible: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
   const [isTickerVisible, setTickerVisible] = useState(true);

   return (
      <LayoutContext.Provider value={{ isTickerVisible, setTickerVisible }}>
         {children}
      </LayoutContext.Provider>
   );
};

export const useLayout = () => {
   const context = useContext(LayoutContext);
   if (context === undefined) {
      throw new Error('useLayout must be used within a LayoutProvider');
   }
   return context;
};

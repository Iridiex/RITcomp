import { createContext, useContext } from 'react';

export const InspectContext = createContext(null);

export function useInspect() {
    return useContext(InspectContext);
}

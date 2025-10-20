import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Profile, Message } from '../services/supabaseClient';

// Types
interface AppState {
  user: Profile | null;
  currentConversation: Message[];
  placementTestProgress: number;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  syncStatus: 'synced' | 'syncing' | 'error';
}

type AppAction =
  | { type: 'SET_USER'; payload: Profile | null }
  | { type: 'SET_CONVERSATION'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; message: Partial<Message> } }
  | { type: 'SET_PLACEMENT_TEST_PROGRESS'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'SET_SYNC_STATUS'; payload: 'synced' | 'syncing' | 'error' }
  | { type: 'CLEAR_CONVERSATION' };

// Initial state
const initialState: AppState = {
  user: null,
  currentConversation: [],
  placementTestProgress: 0,
  isLoading: false,
  error: null,
  isOffline: false,
  syncStatus: 'synced'
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    
    case 'SET_CONVERSATION':
      return { ...state, currentConversation: action.payload };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        currentConversation: [...state.currentConversation, action.payload]
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        currentConversation: state.currentConversation.map(msg =>
          msg.id === action.payload.id 
            ? { ...msg, ...action.payload.message }
            : msg
        )
      };
    
    case 'SET_PLACEMENT_TEST_PROGRESS':
      return { ...state, placementTestProgress: action.payload };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    
    case 'SET_OFFLINE':
      return { ...state, isOffline: action.payload };
    
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    
    case 'CLEAR_CONVERSATION':
      return { ...state, currentConversation: [] };
    
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Helper functions for common actions
export const appActions = {
  setUser: (user: Profile | null) => ({ type: 'SET_USER' as const, payload: user }),
  setConversation: (messages: Message[]) => ({ type: 'SET_CONVERSATION' as const, payload: messages }),
  addMessage: (message: Message) => ({ type: 'ADD_MESSAGE' as const, payload: message }),
  updateMessage: (id: string, message: Partial<Message>) => ({ 
    type: 'UPDATE_MESSAGE' as const, 
    payload: { id, message } 
  }),
  setPlacementTestProgress: (progress: number) => ({ 
    type: 'SET_PLACEMENT_TEST_PROGRESS' as const, 
    payload: progress 
  }),
  setLoading: (loading: boolean) => ({ type: 'SET_LOADING' as const, payload: loading }),
  setError: (error: string | null) => ({ type: 'SET_ERROR' as const, payload: error }),
  setOffline: (offline: boolean) => ({ type: 'SET_OFFLINE' as const, payload: offline }),
  setSyncStatus: (status: 'synced' | 'syncing' | 'error') => ({ 
    type: 'SET_SYNC_STATUS' as const, 
    payload: status 
  }),
  clearConversation: () => ({ type: 'CLEAR_CONVERSATION' as const })
};
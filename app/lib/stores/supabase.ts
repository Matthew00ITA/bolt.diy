import { atom } from 'nanostores';
import type { SupabaseUser, SupabaseStats } from '~/types/supabase';

interface SupabaseConnectionState {
  user: SupabaseUser | null;
  token: string;
  stats?: SupabaseStats;
  selectedProjectId?: string;
}

// Init from localStorage if available
const savedConnection = typeof localStorage !== 'undefined' ? localStorage.getItem('supabase_connection') : null;

const initialState: SupabaseConnectionState = savedConnection
  ? JSON.parse(savedConnection)
  : {
      user: null,
      token: '',
      stats: undefined,
      selectedProjectId: undefined,
    };

export const supabaseConnection = atom<SupabaseConnectionState>(initialState);

// After init, fetch stats if we have a token
if (initialState.token && !initialState.stats) {
  fetchSupabaseStats(initialState.token).catch(console.error);
}

export const isConnecting = atom(false);
export const isFetchingStats = atom(false);

export function updateSupabaseConnection(connection: Partial<SupabaseConnectionState>) {
  const currentState = supabaseConnection.get();
  const newState = { ...currentState, ...connection };
  supabaseConnection.set(newState);

  if (connection.user || connection.token || connection.selectedProjectId !== undefined) {
    localStorage.setItem('supabase_connection', JSON.stringify(newState));
  } else {
    localStorage.removeItem('supabase_connection');
  }
}

export async function fetchSupabaseStats(token: string) {
  isFetchingStats.set(true);

  try {
    const response = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }

    const projects = (await response.json()) as any;

    updateSupabaseConnection({
      stats: {
        projects,
        totalProjects: projects.length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch Supabase stats:', error);
    throw error;
  } finally {
    isFetchingStats.set(false);
  }
}

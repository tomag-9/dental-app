import type { components } from './schema.d.ts';

/** Shorthand for schema component types */
export type Schemas = components['schemas'];

declare global {
  interface Window {
    __API_BASE_URL?: string;
    __MOLARIS_WORKSPACE?: unknown;
    __INITIAL_ROLE?: string;
    React: typeof import('react');
    ReactDOM: typeof import('react-dom/client');
    MolarisAPI: Record<string, unknown>;
  }

  /** React is set as a global by main.js (`window.React = React`) */
  const React: typeof import('react');
  const ReactDOM: typeof import('react-dom/client');

  /** Augmented Error with API response data */
  interface ApiError extends Error {
    status: number;
    data: unknown;
    requiresTotp?: boolean;
    invalidTotp?: boolean;
    _retried?: boolean;
  }
}

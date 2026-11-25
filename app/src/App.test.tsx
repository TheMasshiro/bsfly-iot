import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, vi, test, expect } from 'vitest';
import App from './App';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@ionic/react', async () => {
  const actual = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  return {
    ...actual,
    setupIonicReact: () => {},
    IonApp: ({ children }: { children: React.ReactNode }) => <div data-testid="ion-app">{children}</div>,
    IonSplitPane: ({ children }: { children: React.ReactNode }) => <div data-testid="ion-split-pane">{children}</div>,
    IonRouterOutlet: ({ children }: { children: React.ReactNode }) => <div data-testid="ion-router-outlet">{children}</div>,
  };
});

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
  useUser: () => ({ user: { id: 'test-user' }, isLoaded: true }),
  useAuth: () => ({
    getToken: async () => 'test-token',
    isLoaded: true,
    userId: 'test-user',
  }),
}));

vi.mock('@ionic/react-router', () => ({
  IonReactRouter: ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>{children}</MemoryRouter>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

test('renders without crashing', () => {
  const { baseElement, unmount } = render(<App />);
  expect(baseElement).toBeDefined();
  unmount();
});

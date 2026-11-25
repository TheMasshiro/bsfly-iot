import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { applyTheme } from './theme/theme'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const isDark = applyTheme() === 'dark'

const clerkAppearance = {
    baseTheme: isDark ? dark : undefined,
    variables: {
        colorPrimary: isDark ? '#7cc487' : '#2e6b3a',
        colorBackground: isDark ? '#161b18' : '#ffffff',
        colorText: isDark ? '#e6ebe6' : '#1b1f1a',
        colorTextSecondary: isDark ? '#a2aca4' : '#565c53',
        colorDanger: isDark ? '#f07167' : '#b3261e',
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
        borderRadius: '10px',
    },
    elements: {
        card: { boxShadow: 'none', border: isDark ? '1px solid #252d29' : '1px solid #e3e1d8' },
    },
}

const container = document.getElementById('root');
const root = createRoot(container!);
const boot = import.meta.env.MODE === 'demo' ? import('./demo/install') : Promise.resolve();
boot.then(() => root.render(
    <React.StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
            <App />
        </ClerkProvider>
    </React.StrictMode>
));

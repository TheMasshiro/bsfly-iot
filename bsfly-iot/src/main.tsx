import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ClerkProvider } from '@clerk/clerk-react'
import { dark } from '@clerk/themes'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const clerkAppearance = {
    baseTheme: dark,
    variables: {
        colorPrimary: '#2dd55b',
        colorBackground: '#0a0a0a',
        colorInputBackground: '#1a1a1a',
        colorInputText: '#ffffff',
        colorText: '#ffffff',
        colorTextSecondary: '#a0a0a0',
        colorDanger: '#ff4757',
        colorSuccess: '#2dd55b',
        colorWarning: '#ffc409',
        borderRadius: '16px',
    },
    elements: {
        rootBox: {
            boxShadow: 'none',
        },
        card: {
            backgroundColor: '#0a0a0a',
            border: '1px solid #2a2a2a',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            borderRadius: '18px',
        },
        headerTitle: {
            color: '#ffffff',
        },
        headerSubtitle: {
            color: '#a0a0a0',
        },
        socialButtonsBlockButton: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
        },
        socialButtonsBlockButtonText: {
            color: '#ffffff',
        },
        formButtonPrimary: {
            backgroundColor: '#2dd55b',
            borderRadius: '16px',
        },
        formFieldInput: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
            color: '#ffffff',
        },
        formFieldLabel: {
            color: '#a0a0a0',
        },
        footerActionLink: {
            color: '#2dd55b',
        },
        dividerLine: {
            backgroundColor: '#2a2a2a',
        },
        dividerText: {
            color: '#666666',
        },
        identityPreviewEditButtonIcon: {
            color: '#2dd55b',
        },
        formFieldInputShowPasswordButton: {
            color: '#a0a0a0',
        },
        otpCodeFieldInput: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '12px',
        },
    },
}

const container = document.getElementById('root');
const root = createRoot(container!);

const MissingPublishableKey = () => (
    <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#0a0a0a',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
    }}>
        <div>
            <h1 style={{ margin: '0 0 12px', fontSize: '1.5rem' }}>App configuration missing</h1>
            <p style={{ margin: 0, color: '#a0a0a0', lineHeight: 1.5 }}>
                The Clerk publishable key is not configured. Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> and rebuild the app.
            </p>
        </div>
    </div>
)

root.render(
    <React.StrictMode>
        {PUBLISHABLE_KEY ? (
            <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
                <App />
            </ClerkProvider>
        ) : (
            <MissingPublishableKey />
        )}
    </React.StrictMode>
);

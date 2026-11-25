import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import LoadingSkeleton from './components/LoadingSkeleton/LoadingSkeleton';
import { initializeNotificationChannels } from './services/notificationChannels';

import '@ionic/react/css/core.css';

import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import '@ionic/react/css/palettes/dark.class.css';

import './theme/fonts';
import './theme/variables.css';
import './theme/layout.css';
import './components/ui/ui.css';
import './components/shell/shell.css';
import LiveSync from './components/shell/LiveSync';
import { ThemeProvider } from './theme/theme';
import { LifeCycleProvider } from './context/LifeCycleContext';
import { DeviceProvider } from './context/DeviceContext';
import { NotificationProvider } from './context/NotificationContext';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Light = lazy(() => import('./pages/Light/Light'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));
const Devices = lazy(() => import('./pages/Devices/Devices'));
const About = lazy(() => import('./pages/About/About'));
const Backup = lazy(() => import('./pages/Backup/Backup'));
const Welcome = lazy(() => import('./pages/Welcome/Welcome'));
const Menu = lazy(() => import('./components/Menu/Menu'));
const DeviceMenu = lazy(() => import('./components/DeviceMenu/DeviceMenu'));
const Notifications = lazy(() => import('./components/Notification/Notifications'));

setupIonicReact({ mode: 'md' });

const PageLoader = () => (
    <div className="page-container">
        <LoadingSkeleton variant="card" count={2} />
    </div>
);

const App: React.FC = () => {
    useEffect(() => {
        initializeNotificationChannels();
    }, []);

    return (
        <IonApp>
            <ThemeProvider>
            <ErrorBoundary>
            <LifeCycleProvider>
                <DeviceProvider>
                    <NotificationProvider>
                        <IonReactRouter>
                        <SignedIn>
                            <LiveSync />
                            <IonSplitPane contentId="main" when="(min-width: 768px)">
                                <Suspense fallback={null}><Menu /></Suspense>
                                <IonRouterOutlet id="main">
                                    <Route path="/" exact={true}>
                                        <Redirect to="/dashboard" />
                                    </Route>
                                    <Route exact path="/welcome">
                                        <Redirect to="/dashboard" />
                                    </Route>
                                    <Route path="/dashboard" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Dashboard /></Suspense>
                                    </Route>
                                    <Route path="/light" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Light /></Suspense>
                                    </Route>
                                    <Route path="/analytics" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Analytics /></Suspense>
                                    </Route>
                                    <Route path="/devices" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Devices /></Suspense>
                                    </Route>
                                    <Route path="/about" exact={true}>
                                        <Suspense fallback={<PageLoader />}><About /></Suspense>
                                    </Route>
                                    <Route path="/data/backup" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Backup /></Suspense>
                                    </Route>
                                </IonRouterOutlet>
                            </IonSplitPane>
                            <Suspense fallback={null}><DeviceMenu /></Suspense>
                            <Suspense fallback={null}><Notifications /></Suspense>
                        </SignedIn>

                        <SignedOut>
                            <Route exact path="/welcome">
                                <Suspense fallback={<PageLoader />}><Welcome /></Suspense>
                            </Route>
                            <Route path="/(dashboard|light|analytics|devices|about|data/backup)">
                                <Redirect to="/welcome" />
                            </Route>
                            <Route exact path="/">
                                <Redirect to="/welcome" />
                            </Route>
                        </SignedOut>
                    </IonReactRouter>
                    </NotificationProvider>
                </DeviceProvider>
            </LifeCycleProvider>
            </ErrorBoundary>
            </ThemeProvider>
        </IonApp>
    );
};

export default App;

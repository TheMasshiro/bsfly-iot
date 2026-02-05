import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Menu from './components/Menu/Menu';
import DeviceMenu from './components/DeviceMenu/DeviceMenu';
import Notifications from './components/Notification/Notifications';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import LoadingSkeleton from './components/LoadingSkeleton/LoadingSkeleton';

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

import '@ionic/react/css/palettes/dark.always.css';

import './theme/variables.css';
import { LifeCycleProvider } from './context/LifeCycleContext';
import { DeviceProvider } from './context/DeviceContext';
import { NotificationProvider } from './context/NotificationContext';
import { SignedIn, SignedOut } from '@clerk/clerk-react';

const Dashboard = lazy(() => import('./pages/Dashboard/Dashboard'));
const Light = lazy(() => import('./pages/Light/Light'));
const Analytics = lazy(() => import('./pages/Analytics/Analytics'));
const Settings = lazy(() => import('./pages/Settings/Settings'));
const About = lazy(() => import('./pages/About/About'));
const Backup = lazy(() => import('./pages/Backup/Backup'));
const LifeStages = lazy(() => import('./pages/LifeStage/LifeStages'));
const Welcome = lazy(() => import('./pages/Welcome/Welcome'));

setupIonicReact();

const PageLoader = () => (
    <div style={{ padding: '20px' }}>
        <LoadingSkeleton variant="card" count={2} />
    </div>
);

const App: React.FC = () => {
    return (
        <IonApp>
            <ErrorBoundary>
            <LifeCycleProvider>
                <DeviceProvider>
                    <NotificationProvider>
                        <IonReactRouter>
                        <SignedIn>
                            <IonSplitPane contentId="main">
                                <Menu />
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
                                    <Route path="/lifestages" exact={true}>
                                        <Suspense fallback={<PageLoader />}><LifeStages /></Suspense>
                                    </Route>
                                    <Route path="/settings" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Settings /></Suspense>
                                    </Route>
                                    <Route path="/about" exact={true}>
                                        <Suspense fallback={<PageLoader />}><About /></Suspense>
                                    </Route>
                                    <Route path="/data/backup" exact={true}>
                                        <Suspense fallback={<PageLoader />}><Backup /></Suspense>
                                    </Route>
                                </IonRouterOutlet>
                            </IonSplitPane>
                            <DeviceMenu />
                            <Notifications />
                        </SignedIn>

                        <SignedOut>
                            <Route exact path="/welcome">
                                <Suspense fallback={<PageLoader />}><Welcome /></Suspense>
                            </Route>
                            <Route path="/(dashboard|light|analytics|lifestages|settings|about|data/backup)">
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
        </IonApp>
    );
};

export default App;

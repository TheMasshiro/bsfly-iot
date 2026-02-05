import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import Menu from './components/Menu/Menu';
import DeviceMenu from './components/DeviceMenu/DeviceMenu';
import Notifications from './components/Notification/Notifications';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';

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
import Dashboard from './pages/Dashboard/Dashboard';
import { LifeCycleProvider } from './context/LifeCycleContext';
import { DeviceProvider } from './context/DeviceContext';
import { NotificationProvider } from './context/NotificationContext';
import Light from './pages/Light/Light';
import Analytics from './pages/Analytics/Analytics';
import Settings from './pages/Settings/Settings';
import About from './pages/About/About';
import Backup from './pages/Backup/Backup';
import LifeStages from './pages/LifeStage/LifeStages';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Welcome from './pages/Welcome/Welcome';

setupIonicReact();

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
                                    <Route path="/dashboard" exact={true} component={Dashboard} />
                                    <Route path="/light" exact={true} component={Light} />
                                    <Route path="/analytics" exact={true} component={Analytics} />
                                    <Route path="/lifestages" exact={true} component={LifeStages} />
                                    <Route path="/settings" exact={true} component={Settings} />
                                    <Route path="/about" exact={true} component={About} />
                                    <Route path="/data/backup" exact={true} component={Backup} />
                                </IonRouterOutlet>
                            </IonSplitPane>
                            <DeviceMenu />
                            <Notifications />
                        </SignedIn>

                        <SignedOut>
                            <Route exact path="/welcome" component={Welcome} />
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

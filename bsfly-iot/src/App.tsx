import { IonApp, IonRouterOutlet, IonSplitPane, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route } from 'react-router-dom';
import Menu from './components/Menu/Menu';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

import '@ionic/react/css/palettes/dark.always.css';
/* import '@ionic/react/css/palettes/dark.class.css'; */
// import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import Dashboard from './pages/Dashboard/Dashboard';
import { LifeCycleProvider } from './context/LifeCycleContext';
import Timer from './pages/Timer/Timer';
import Analytics from './pages/Analytics/Analytics';
import Settings from './pages/Settings/Settings';
import About from './pages/About/About';

setupIonicReact();

const App: React.FC = () => {
    return (
        <IonApp>
            <LifeCycleProvider>
                <IonReactRouter>
                    <IonSplitPane contentId="main">
                        <Menu />
                        <IonRouterOutlet id="main">
                            <Route path="/" exact={true}>
                                <Redirect to="/dashboard" />
                            </Route>
                            <Route path="/dashboard" exact={true} component={Dashboard} />
                            <Route path="/photoperiod" exact={true} component={Timer} />
                            <Route path="/analytics" exact={true} component={Analytics} />
                            <Route path="/settings" exact={true} component={Settings} />
                            <Route path="/about" exact={true} component={About} />
                        </IonRouterOutlet>
                    </IonSplitPane>
                </IonReactRouter>
            </LifeCycleProvider>
        </IonApp>
    );
};

export default App;

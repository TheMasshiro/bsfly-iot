import {
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonMenu,
    IonMenuToggle,
    IonNote,
} from '@ionic/react';

import { useLocation } from 'react-router-dom';
import { analyticsOutline, analyticsSharp, exitOutline, exitSharp, eyeOutline, eyeSharp, gridOutline, gridSharp, informationCircleOutline, informationCircleSharp, saveOutline, saveSharp, settingsOutline, settingsSharp, timeOutline, timeSharp } from 'ionicons/icons';
import './Menu.css';

interface AppPage {
    url: string;
    iosIcon: string;
    mdIcon: string;
    title: string;
}

const appPages: AppPage[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        iosIcon: gridOutline,
        mdIcon: gridSharp
    },
    {
        title: 'Timer',
        url: '/photoperiod',
        iosIcon: timeOutline,
        mdIcon: timeSharp
    },
    {
        title: 'Analytics',
        url: '/analytics',
        iosIcon: analyticsOutline,
        mdIcon: analyticsSharp
    },
];

const morePage: AppPage[] = [
    {
        title: 'Settings',
        url: '/settings',
        iosIcon: settingsOutline,
        mdIcon: settingsSharp
    },
    {
        title: 'View Data',
        url: '/data/view',
        iosIcon: eyeOutline,
        mdIcon: eyeSharp
    },
    {
        title: 'Backup Data',
        url: '/data/backup',
        iosIcon: saveOutline,
        mdIcon: saveSharp
    },
    {
        title: 'About',
        url: '/about',
        iosIcon: informationCircleOutline,
        mdIcon: informationCircleSharp
    }
]

const Menu: React.FC = () => {
    const location = useLocation();

    return (
        <IonMenu contentId="main" type="overlay">
            <IonContent>
                <IonList id="main-list">
                    <IonListHeader>Farmer's Name</IonListHeader>
                    <IonNote>Good Evening</IonNote>
                    {appPages.map((appPage, index) => {
                        return (
                            <IonMenuToggle key={index}>
                                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                    <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                    <IonLabel>{appPage.title}</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        );
                    })}
                </IonList>

                <IonList id="labels-list">
                    {morePage.map((appPage, index) => {
                        return (
                            <IonMenuToggle key={index}>
                                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                    <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                    <IonLabel>{appPage.title}</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        );
                    })}
                </IonList>

                <IonList id="account-list">
                    <IonMenuToggle>
                        <IonItem lines='none' detail={false} button>
                            <IonIcon color="danger" aria-hidden="true" slot="start" ios={exitSharp} md={exitOutline} />
                            <IonLabel color="danger">Sign Out</IonLabel>
                        </IonItem>
                    </IonMenuToggle>
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

export default Menu;

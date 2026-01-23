import {
    IonAvatar,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonMenu,
    IonMenuToggle,
} from '@ionic/react';

import { useLocation } from 'react-router-dom';
import { analyticsOutline, analyticsSharp, exitOutline, exitSharp, eyeOutline, eyeSharp, gridOutline, gridSharp, informationCircleOutline, informationCircleSharp, saveOutline, saveSharp, settingsOutline, settingsSharp, timeOutline, timeSharp } from 'ionicons/icons';
import './Menu.css';
import { SignOutButton, useUser } from '@clerk/clerk-react';

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
        title: 'Light',
        url: '/light',
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
    const { user } = useUser();

    return (
        <IonMenu menuId="open-menu" contentId="main" type="overlay">
            <IonContent>
                <IonList id="main-list">
                    <IonList>
                        <IonItem lines="none" button={false}>
                            <IonLabel>
                                <h1>Black Soldier Fly</h1>
                            </IonLabel>
                        </IonItem>

                        <IonItem lines="none">
                            <IonAvatar slot="start">
                                <img src={user?.imageUrl} alt={user?.fullName ?? 'User avatar'} />
                            </IonAvatar>

                            <IonLabel>
                                <h2>{user?.fullName}</h2>
                                <p>{user?.primaryEmailAddress?.emailAddress}</p>
                            </IonLabel>
                        </IonItem>
                    </IonList>
                    {appPages.map((appPage) => {
                        return (
                            <IonMenuToggle key={appPage.url} autoHide={false}>
                                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                    <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                    <IonLabel>{appPage.title}</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        );
                    })}
                </IonList>

                <IonList id="labels-list">
                    {morePage.map((appPage) => {
                        return (
                            <IonMenuToggle key={appPage.url} autoHide={false}>
                                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                    <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                    <IonLabel>{appPage.title}</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        );
                    })}
                </IonList>

                <IonList id="account-list">
                    <IonMenuToggle autoHide={false}>
                        <IonItem lines='none' detail={false} button>
                            <IonIcon color="danger" aria-hidden="true" slot="start" ios={exitSharp} md={exitOutline} />
                            <SignOutButton>
                                <IonLabel color="danger">Sign Out</IonLabel>
                            </SignOutButton>
                        </IonItem>
                    </IonMenuToggle>
                </IonList>
            </IonContent>
        </IonMenu>
    );
};

export default Menu;

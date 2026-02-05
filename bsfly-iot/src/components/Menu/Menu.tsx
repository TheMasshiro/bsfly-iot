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
import { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { analyticsOutline, analyticsSharp, bugOutline, exitOutline, exitSharp, gridOutline, gridSharp, informationCircleOutline, informationCircleSharp, leafOutline, leafSharp, saveOutline, saveSharp, settingsOutline, settingsSharp, sunnyOutline, sunnySharp } from 'ionicons/icons';
import './Menu.css';
import { SignOutButton, useUser } from '@clerk/clerk-react';

interface MenuItemProps {
    url: string;
    iosIcon: string;
    mdIcon: string;
    title: string;
}

const appPages: MenuItemProps[] = [
    {
        title: 'Dashboard',
        url: '/dashboard',
        iosIcon: gridOutline,
        mdIcon: gridSharp
    },
    {
        title: 'Light',
        url: '/light',
        iosIcon: sunnyOutline,
        mdIcon: sunnySharp
    },
    {
        title: 'Analytics',
        url: '/analytics',
        iosIcon: analyticsOutline,
        mdIcon: analyticsSharp
    },
    {
        title: 'Life Stages',
        url: '/lifestages',
        iosIcon: leafOutline,
        mdIcon: leafSharp
    },
];

const morePage: MenuItemProps[] = [
    {
        title: 'Settings',
        url: '/settings',
        iosIcon: settingsOutline,
        mdIcon: settingsSharp
    },
    {
        title: 'Backup',
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

const Menu: FC = () => {
    const location = useLocation();
    const { user } = useUser();

    return (
        <IonMenu menuId="open-menu" contentId="main" type="overlay">
            <IonContent>
                <div className="menu-header">
                    <div className="menu-logo">
                        <IonIcon icon={bugOutline} className="logo-icon" />
                    </div>
                    <h1 className="menu-title">Black Soldier Fly</h1>
                    <p className="menu-subtitle">IoT Monitoring System</p>
                </div>

                <div className="menu-user">
                    <IonAvatar className="user-avatar">
                        <img src={user?.imageUrl} alt={user?.fullName ?? 'User avatar'} />
                    </IonAvatar>
                    <div className="user-info">
                        <span className="user-name">{user?.fullName}</span>
                        <span className="user-email">{user?.primaryEmailAddress?.emailAddress}</span>
                    </div>
                </div>

                <IonList id="main-list">
                    {appPages.map((appPage) => (
                        <IonMenuToggle key={appPage.url} autoHide={false}>
                            <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                <IonLabel>{appPage.title}</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                    ))}
                </IonList>

                <IonList id="labels-list">
                    {morePage.map((appPage) => (
                        <IonMenuToggle key={appPage.url} autoHide={false}>
                            <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                <IonLabel>{appPage.title}</IonLabel>
                            </IonItem>
                        </IonMenuToggle>
                    ))}
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

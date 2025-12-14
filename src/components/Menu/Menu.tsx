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
import { archiveOutline, archiveSharp, heartOutline, heartSharp, mailOutline, mailSharp, paperPlaneOutline, paperPlaneSharp, trashOutline, trashSharp, warningOutline, warningSharp } from 'ionicons/icons';
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
        iosIcon: mailOutline,
        mdIcon: mailSharp
    },
    {
        title: 'Timer',
        url: '/photoperiod',
        iosIcon: mailOutline,
        mdIcon: mailSharp
    },
    {
        title: 'Analytics',
        url: '/analytics',
        iosIcon: paperPlaneOutline,
        mdIcon: paperPlaneSharp
    },
    {
        title: 'Settings',
        url: '/settings',
        iosIcon: heartOutline,
        mdIcon: heartSharp
    },
    {
        title: 'View Data',
        url: '/data/view',
        iosIcon: archiveOutline,
        mdIcon: archiveSharp
    },
    {
        title: 'Backup Data',
        url: '/data/backup',
        iosIcon: trashOutline,
        mdIcon: trashSharp
    },
    {
        title: 'About',
        url: '/about',
        iosIcon: warningOutline,
        mdIcon: warningSharp
    }
];

const Menu: React.FC = () => {
    const location = useLocation();

    return (
        <IonMenu contentId="main" type="overlay">
            <IonContent>
                <IonList id="inbox-list">
                    <IonListHeader>Inbox</IonListHeader>
                    <IonNote>hi@ionicframework.com</IonNote>
                    {appPages.map((appPage, index) => {
                        return (
                            <IonMenuToggle key={index} autoHide={true}>
                                <IonItem className={location.pathname === appPage.url ? 'selected' : ''} routerLink={appPage.url} routerDirection="none" lines="none" detail={false}>
                                    <IonIcon aria-hidden="true" slot="start" ios={appPage.iosIcon} md={appPage.mdIcon} />
                                    <IonLabel>{appPage.title}</IonLabel>
                                </IonItem>
                            </IonMenuToggle>
                        );
                    })}
                </IonList>

                {/* <IonList id="labels-list"> */}
                {/*     <IonListHeader>Labels</IonListHeader> */}
                {/* </IonList> */}
            </IonContent>
        </IonMenu>
    );
};

export default Menu;

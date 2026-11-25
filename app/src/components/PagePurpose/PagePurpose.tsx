import { IonIcon } from '@ionic/react';
import { informationCircleOutline } from 'ionicons/icons';
import { FC } from 'react';
import './PagePurpose.css';

interface PagePurposeProps {
    text: string;
}

const PagePurpose: FC<PagePurposeProps> = ({ text }) => {
    return (
        <section className="page-purpose-banner" aria-label="Page purpose">
            <p className="page-purpose-text">
                <IonIcon icon={informationCircleOutline} aria-hidden="true" />
                <span>{text}</span>
            </p>
        </section>
    );
};

export default PagePurpose;
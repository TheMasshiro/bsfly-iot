import { IonSkeletonText } from '@ionic/react';
import { FC } from 'react';
import './LoadingSkeleton.css';

interface Props {
    variant?: 'card' | 'list-item' | 'text' | 'circle' | 'graph';
    count?: number;
}

const LoadingSkeleton: FC<Props> = ({ variant = 'card', count = 1 }) => {
    const items = Array.from({ length: count });

    if (variant === 'card') {
        return (
            <>
                {items.map((_, i) => (
                    <div key={i} className="skeleton-card">
                        <div className="skeleton-card-header">
                            <IonSkeletonText animated className="skeleton-icon" />
                            <div className="skeleton-card-title">
                                <IonSkeletonText animated className="skeleton-title-primary" />
                                <IonSkeletonText animated className="skeleton-title-secondary" />
                            </div>
                        </div>
                        <div className="skeleton-card-value">
                            <IonSkeletonText animated className="skeleton-value" />
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'list-item') {
        return (
            <>
                {items.map((_, i) => (
                    <div key={i} className="skeleton-list-item">
                        <IonSkeletonText animated className="skeleton-avatar" />
                        <div className="skeleton-list-content">
                            <IonSkeletonText animated className="skeleton-list-primary" />
                            <IonSkeletonText animated className="skeleton-list-secondary" />
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'graph') {
        return (
            <div className="skeleton-graph">
                <IonSkeletonText animated className="skeleton-graph-content" />
            </div>
        );
    }

    if (variant === 'circle') {
        return (
            <div className="skeleton-circle">
                <IonSkeletonText animated className="skeleton-circle-content" />
            </div>
        );
    }

    return (
        <>
            {items.map((_, i) => (
                <IonSkeletonText key={i} animated className="skeleton-text" />
            ))}
        </>
    );
};

export default LoadingSkeleton;

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
                            <IonSkeletonText animated style={{ width: '40px', height: '40px', borderRadius: '8px' }} />
                            <div className="skeleton-card-title">
                                <IonSkeletonText animated style={{ width: '60%', height: '16px' }} />
                                <IonSkeletonText animated style={{ width: '40%', height: '12px' }} />
                            </div>
                        </div>
                        <div className="skeleton-card-value">
                            <IonSkeletonText animated style={{ width: '50%', height: '32px' }} />
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
                        <IonSkeletonText animated style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                        <div className="skeleton-list-content">
                            <IonSkeletonText animated style={{ width: '70%', height: '16px' }} />
                            <IonSkeletonText animated style={{ width: '50%', height: '12px' }} />
                        </div>
                    </div>
                ))}
            </>
        );
    }

    if (variant === 'graph') {
        return (
            <div className="skeleton-graph">
                <IonSkeletonText animated style={{ width: '100%', height: '200px', borderRadius: '12px' }} />
            </div>
        );
    }

    if (variant === 'circle') {
        return (
            <div className="skeleton-circle">
                <IonSkeletonText animated style={{ width: '150px', height: '150px', borderRadius: '50%' }} />
            </div>
        );
    }

    return (
        <>
            {items.map((_, i) => (
                <IonSkeletonText key={i} animated style={{ width: '100%', height: '16px', marginBottom: '8px' }} />
            ))}
        </>
    );
};

export default LoadingSkeleton;

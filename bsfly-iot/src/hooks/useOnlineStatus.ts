import { useState, useEffect } from 'react';
import { offlineService } from '../services/offline/OfflineService';

export const useOnlineStatus = (): boolean => {
    const [isOnline, setIsOnline] = useState(offlineService.getOnlineStatus());

    useEffect(() => {
        return offlineService.subscribe(setIsOnline);
    }, []);

    return isOnline;
};

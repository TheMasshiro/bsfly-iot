export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export const validateMacAddress = (mac: string): ValidationResult => {
    if (!mac.trim()) {
        return { valid: false, error: 'MAC address is required' };
    }
    
    const macRegex = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    if (!macRegex.test(mac.trim())) {
        return { valid: false, error: 'Invalid format. Use XX:XX:XX:XX:XX:XX' };
    }
    
    return { valid: true };
};

export const validateDeviceName = (name: string): ValidationResult => {
    if (!name.trim()) {
        return { valid: false, error: 'Device name is required' };
    }
    
    if (name.trim().length < 2) {
        return { valid: false, error: 'Name must be at least 2 characters' };
    }
    
    if (name.trim().length > 50) {
        return { valid: false, error: 'Name must be 50 characters or less' };
    }
    
    const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validNameRegex.test(name.trim())) {
        return { valid: false, error: 'Only letters, numbers, spaces, hyphens, underscores allowed' };
    }
    
    return { valid: true };
};

export const validateJoinCode = (code: string): ValidationResult => {
    if (!code.trim()) {
        return { valid: false, error: 'Join code is required' };
    }
    
    if (code.trim().length !== 8) {
        return { valid: false, error: 'Join code must be 8 characters' };
    }
    
    const codeRegex = /^[A-Za-z0-9]+$/;
    if (!codeRegex.test(code.trim())) {
        return { valid: false, error: 'Join code must be alphanumeric' };
    }
    
    return { valid: true };
};

export const formatMacAddress = (input: string): string => {
    const cleaned = input.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const parts = cleaned.match(/.{1,2}/g) || [];
    return parts.slice(0, 6).join(':');
};

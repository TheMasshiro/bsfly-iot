export interface DeviceMember {
    userId: string;
    role: "owner" | "member";
    joinedAt: string;
    name?: string;
    email?: string;
}

export interface Device {
    _id: string;
    macAddress: string;
    name: string;
    ownerId: string;
    status: "online" | "offline";
    controlMode?: "auto" | "manual";
    joinCode: string;
    members: DeviceMember[];
    lastSeen?: string;
    ipAddress?: string;
}

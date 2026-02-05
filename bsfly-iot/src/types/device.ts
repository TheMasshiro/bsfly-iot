export interface DeviceMember {
    userId: string;
    role: "owner" | "member";
    joinedAt: string;
    name?: string;
    email?: string;
}

export interface Device {
    _id: string;
    name: string;
    ownerId: string;
    status: "online" | "offline";
    joinCode: string;
    members: DeviceMember[];
    lastSeen?: string;
}

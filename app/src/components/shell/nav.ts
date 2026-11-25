import { albumsOutline, analyticsOutline, homeOutline, informationCircleOutline, hardwareChipOutline, sunnyOutline } from "ionicons/icons";

export interface NavItem {
  label: string;
  url: string;
  icon: string;
}

export const primaryNav: NavItem[] = [
  { label: "Home", url: "/dashboard", icon: homeOutline },
  { label: "Light", url: "/light", icon: sunnyOutline },
  { label: "Trends", url: "/analytics", icon: analyticsOutline },
  { label: "Devices", url: "/devices", icon: hardwareChipOutline },
];

export const secondaryNav: NavItem[] = [
  { label: "Export data", url: "/data/backup", icon: albumsOutline },
  { label: "About", url: "/about", icon: informationCircleOutline },
];

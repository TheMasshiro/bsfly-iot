import { IonIcon } from "@ionic/react";
import { FC, ReactNode } from "react";

const EmptyState: FC<{ icon?: string; title: string; children?: ReactNode; action?: ReactNode }> = ({ icon, title, children, action }) => (
  <div className="bs-empty">
    {icon && <IonIcon icon={icon} aria-hidden="true" />}
    <h2>{title}</h2>
    {children && <p>{children}</p>}
    {action}
  </div>
);

export default EmptyState;

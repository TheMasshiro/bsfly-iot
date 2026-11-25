import { IonIcon, IonToggle } from "@ionic/react";
import { FC, ReactNode } from "react";

interface SwitchRowProps {
  label: string;
  detail?: ReactNode;
  icon?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

const SwitchRow: FC<SwitchRowProps> = ({ label, detail, icon, checked, disabled, onChange }) => (
  <div className="bs-switch-row" data-on={checked}>
    {icon && <IonIcon className="lead" icon={icon} aria-hidden="true" />}
    <div className="bs-switch-text">
      <strong>{label}</strong>
      {detail && <span>{detail}</span>}
    </div>
    <IonToggle
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onIonChange={(e) => onChange(e.detail.checked)}
    />
  </div>
);

export default SwitchRow;

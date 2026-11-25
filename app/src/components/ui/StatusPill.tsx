import { FC, ReactNode } from "react";
import { Status } from "./status";

const StatusPill: FC<{ status: Status; plain?: boolean; children: ReactNode }> = ({ status, plain, children }) => (
  <span className={`bs-pill ${plain ? "plain" : ""}`} data-status={status}>
    {children}
  </span>
);

export default StatusPill;

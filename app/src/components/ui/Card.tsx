import { FC, ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

const Card: FC<CardProps> = ({ title, action, flush, className = "", children }) => (
  <section className={`bs-card ${flush ? "flush" : ""} ${className}`}>
    {(title || action) && (
      <div className="bs-card-head">
        {title && <h2 className="bs-card-title">{title}</h2>}
        {action}
      </div>
    )}
    <div className="bs-card-body">{children}</div>
  </section>
);

export default Card;

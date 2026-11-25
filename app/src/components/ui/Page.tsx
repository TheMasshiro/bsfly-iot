import { IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent } from "@ionic/react";
import { FC, ReactNode } from "react";
import AppHeader from "../shell/AppHeader";
import BottomNav from "../shell/BottomNav";

interface PageProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onRefresh?: () => Promise<unknown>;
  className?: string;
  children: ReactNode;
}

const Page: FC<PageProps> = ({ title, subtitle, actions, onRefresh, className = "", children }) => (
  <IonPage className={className}>
    <IonHeader className="ion-no-border">
      <AppHeader />
    </IonHeader>
    <IonContent>
      {onRefresh && (
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await onRefresh();
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>
      )}
      <div className="page-container">
        <header className="bs-page-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="bs-page-actions">{actions}</div>}
        </header>
        {children}
      </div>
    </IonContent>
    <BottomNav />
  </IonPage>
);

export default Page;

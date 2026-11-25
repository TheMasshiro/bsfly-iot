import { IonFooter, IonIcon } from "@ionic/react";
import { menuController } from "@ionic/core/components";
import { ellipsisHorizontal } from "ionicons/icons";
import { FC } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { primaryNav, secondaryNav } from "./nav";

const BottomNav: FC = () => {
  const history = useHistory();
  const { pathname } = useLocation();
  const moreActive = secondaryNav.some((i) => i.url === pathname);

  return (
    <IonFooter className="bs-bottom-nav-wrap ion-no-border">
      <nav className="bs-bottom-nav" aria-label="Main">
        {primaryNav.map((item) => (
          <button
            key={item.url}
            type="button"
            aria-current={pathname === item.url ? "page" : undefined}
            onClick={() => pathname !== item.url && history.push(item.url)}
          >
            <IonIcon icon={item.icon} aria-hidden="true" />
            {item.label}
          </button>
        ))}
        <button type="button" aria-current={moreActive ? "page" : undefined} onClick={() => menuController.open("open-menu")}>
          <IonIcon icon={ellipsisHorizontal} aria-hidden="true" />
          More
        </button>
      </nav>
    </IonFooter>
  );
};

export default BottomNav;

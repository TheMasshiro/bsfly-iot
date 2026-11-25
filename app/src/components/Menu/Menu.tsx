import { IonContent, IonIcon, IonMenu, IonMenuToggle } from "@ionic/react";
import { SignOutButton, useUser } from "@clerk/clerk-react";
import { logOutOutline } from "ionicons/icons";
import { FC } from "react";
import { useHistory, useLocation } from "react-router-dom";
import Segmented from "../ui/Segmented";
import { NavItem, primaryNav, secondaryNav } from "../shell/nav";
import { ThemePref, useTheme } from "../../theme/theme";

const Link: FC<{ item: NavItem; active: boolean; onGo: (url: string) => void }> = ({ item, active, onGo }) => (
  <IonMenuToggle autoHide={false} menu="open-menu">
    <button type="button" className="bs-side-link" aria-current={active ? "page" : undefined} title={item.label} onClick={() => onGo(item.url)}>
      <IonIcon icon={item.icon} aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  </IonMenuToggle>
);

const Menu: FC = () => {
  const { pathname } = useLocation();
  const history = useHistory();
  const { user } = useUser();
  const { pref, setPref } = useTheme();
  const go = (url: string) => url !== pathname && history.push(url);
  const initials = (user?.fullName ?? "?").split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <IonMenu menuId="open-menu" contentId="main" type="overlay" className="bs-sidebar">
      <IonContent>
        <div className="bs-side">
          <div className="bs-brand">
            <div className="bs-brand-mark" aria-hidden="true">BS</div>
            <div className="bs-brand-text">
              <strong>BSFLY</strong>
              <span>Larvae farm monitor</span>
            </div>
          </div>

          <nav className="bs-side-group" aria-label="Main">
            <div className="bs-side-label">Farm</div>
            {primaryNav.map((item) => (
              <Link key={item.url} item={item} active={pathname === item.url} onGo={go} />
            ))}
          </nav>

          <nav className="bs-side-group" aria-label="More">
            <div className="bs-side-label">More</div>
            {secondaryNav.map((item) => (
              <Link key={item.url} item={item} active={pathname === item.url} onGo={go} />
            ))}
          </nav>

          <div className="bs-side-foot">
            <div className="bs-theme">
              <Segmented<ThemePref>
                block
                label="Theme"
                value={pref}
                onChange={setPref}
                options={[
                  { value: "system", label: "Auto" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </div>
            <div className="bs-user">
              <div className="bs-avatar" title={user?.fullName ?? ""}>
                {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : initials}
              </div>
              <div className="bs-user-text">
                <strong>{user?.fullName}</strong>
                <span>{user?.primaryEmailAddress?.emailAddress}</span>
              </div>
            </div>
            <SignOutButton>
              <button type="button" className="bs-side-link" title="Sign out">
                <IonIcon icon={logOutOutline} aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </SignOutButton>
          </div>
        </div>
      </IonContent>
    </IonMenu>
  );
};

export default Menu;

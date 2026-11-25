import { IonIcon } from "@ionic/react";
import { bugOutline, chevronForward, documentTextOutline, globeOutline, logoGithub, peopleOutline, personOutline, ribbonOutline } from "ionicons/icons";
import { FC } from "react";
import Card from "../../components/ui/Card";
import Page from "../../components/ui/Page";
import "./About.css";

const APP_VERSION = "1.0.0";

const researchers = [
    "Advincula, Kristine Joy B.",
    "Bugarin, Jethro Daniel D.",
    "Dagsaan, Jed",
    "Farrales, Mark Niel S.",
    "Maggay, Nigel Bennett",
    "Vicente, John Christian",
];

const stack = [
    { label: "Frontend", value: "React, Ionic, TypeScript, Capacitor" },
    { label: "Backend", value: "Node.js, Express, PostgreSQL" },
    { label: "Hardware", value: "ESP32, DHT11/DHT22, MQ-137, substrate moisture sensors" },
];

const links = [
    { href: "https://github.com/TheMasshiro/bsfly-iot/issues", icon: bugOutline, title: "Report an issue", detail: "Open a GitHub issue" },
    { href: "https://github.com/TheMasshiro/bsfly-iot/blob/main/README.md", icon: documentTextOutline, title: "Documentation", detail: "Setup guide and usage instructions" },
    { href: "https://github.com/TheMasshiro/bsfly-iot", icon: logoGithub, title: "Source code", detail: "View on GitHub" },
    { href: "https://github.com/TheMasshiro/bsfly-iot/blob/main/LICENSE", icon: ribbonOutline, title: "MIT License", detail: "Open source software" },
];

const About: FC = () => (
    <Page
        className="about-page"
        title="About"
        subtitle="What the system does, who built it, and where to get help."
    >
        <div className="card-grid">
            <Card className="card-wide about-intro">
                <p className="about-name">Black Soldier Fly IoT</p>
                <p className="about-version mono">Version {APP_VERSION}</p>
                <p className="about-text">
                    Monitors temperature, humidity, substrate moisture and ammonia in the larvae drawers.
                    Lets you switch the fans, heater, humidifier, pump and light from your phone.
                </p>
            </Card>

            <Card title="Team">
                <div className="about-block">
                    <p className="about-label">
                        <IonIcon icon={personOutline} aria-hidden="true" />
                        Developer
                    </p>
                    <p className="about-person">John Christian Vicente</p>
                    <p className="about-contact">
                        <a href="mailto:johnc.vicente1@gmail.com">johnc.vicente1@gmail.com</a>
                        <a href="https://github.com/TheMasshiro" target="_blank" rel="noopener noreferrer">@TheMasshiro</a>
                    </p>
                </div>
                <div className="about-block">
                    <p className="about-label">
                        <IonIcon icon={peopleOutline} aria-hidden="true" />
                        Research team
                        <span className="mono">{researchers.length}</span>
                    </p>
                    <ul className="about-names">
                        {researchers.map((name) => (
                            <li key={name}>{name}</li>
                        ))}
                    </ul>
                </div>
            </Card>

            <Card title="Technology">
                <dl className="about-stack">
                    {stack.map((item) => (
                        <div key={item.label}>
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                        </div>
                    ))}
                </dl>
            </Card>

            <Card title="Links" className="about-links-card">
                <ul className="about-links">
                    {links.map((link) => (
                        <li key={link.title}>
                            <a href={link.href} target="_blank" rel="noopener noreferrer" className="about-link-row">
                                <IonIcon icon={link.icon} aria-hidden="true" />
                                <span>
                                    <strong>{link.title}</strong>
                                    <small>{link.detail}</small>
                                </span>
                                <IonIcon icon={chevronForward} aria-hidden="true" />
                            </a>
                        </li>
                    ))}
                </ul>
            </Card>
        </div>

        <p className="about-footer">© {new Date().getFullYear()} Black Soldier Fly IoT</p>
    </Page>
);

export default About;

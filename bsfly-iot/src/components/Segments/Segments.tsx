import { IonSegment, IonSegmentButton } from "@ionic/react"
import { FC } from "react"
import { Stage } from "../../context/LifeCycleContext"
import "./Segments.css"

interface SegmentsProps {
    stage: Stage,
    setStage: any
}

const Segments: FC<SegmentsProps> = ({ stage, setStage }) => {
    return (
        <div className="stage-selector-container">
            <IonSegment
                value={stage}
                onIonChange={(e) => setStage(e.detail.value as Stage)}
            >
                <IonSegmentButton value="Egg">
                    <div className="stage-button-content">
                        <span className="stage-label">Egg</span>
                    </div>
                </IonSegmentButton>

                <IonSegmentButton value="Larva">
                    <div className="stage-button-content">
                        <span className="stage-label">Larva</span>
                    </div>
                </IonSegmentButton>

                <IonSegmentButton value="Pupa">
                    <div className="stage-button-content">
                        <span className="stage-label">Pupa</span>
                    </div>
                </IonSegmentButton>

                <IonSegmentButton value="Adult">
                    <div className="stage-button-content">
                        <span className="stage-label">Adult</span>
                    </div>
                </IonSegmentButton>
            </IonSegment>
        </div>
    )
}

export default Segments;

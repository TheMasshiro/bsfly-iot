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
                <IonSegmentButton value="Drawer 1">
                    <div className="stage-button-content">
                        <span className="stage-label">Drawer 1</span>
                    </div>
                </IonSegmentButton>

                <IonSegmentButton value="Drawer 2">
                    <div className="stage-button-content">
                        <span className="stage-label">Drawer 2</span>
                    </div>
                </IonSegmentButton>

                <IonSegmentButton value="Drawer 3">
                    <div className="stage-button-content">
                        <span className="stage-label">Drawer 3</span>
                    </div>
                </IonSegmentButton>
            </IonSegment>
        </div>
    )
}

export default Segments;

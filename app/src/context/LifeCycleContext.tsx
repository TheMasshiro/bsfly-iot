import { createContext, FC, ReactNode, useContext, useState } from "react";

export type Stage = "Drawer 1" | "Drawer 2"

interface LifeCycleContextProps {
    stage: Stage,
    setStage: (value: Stage) => void;
    nextStage: () => void
}

const LifeCycleContext = createContext<LifeCycleContextProps | null>(null);

export const LifeCycleProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [stage, setStage] = useState<Stage>("Drawer 1")

    const nextStage = () => {
        setStage((prev) => {
            switch (prev) {
                case "Drawer 1":
                    return "Drawer 2";
                default:
                    return "Drawer 1";
            }
        })
    }

    return (
        <LifeCycleContext.Provider
            value={{
                stage, setStage, nextStage
            }}>
            {children}
        </LifeCycleContext.Provider>
    )
}

export const useLifeCycle = () => {
    const context = useContext(LifeCycleContext);
    if (!context) throw new Error("LifeCycleContext must be used inside provider")
    return context;
}

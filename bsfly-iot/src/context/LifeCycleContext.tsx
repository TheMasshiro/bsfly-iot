import { createContext, FC, ReactNode, useContext, useState } from "react";

export type Stage = "Egg" | "Larva" | "Pupa" | "Adult"

interface LifeCycleContextProps {
    stage: Stage,
    setStage: (value: Stage) => void;
    nextStage: () => void
}

const LifeCycleContext = createContext<LifeCycleContextProps | null>(null);

export const LifeCycleProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [stage, setStage] = useState<Stage>("Egg")

    const nextStage = () => {
        setStage((prev) => {
            switch (prev) {
                case "Egg":
                    return "Larva";
                case "Larva":
                    return "Pupa";
                case "Pupa":
                    return "Adult";
                default:
                    return "Adult";
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

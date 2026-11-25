import { FC, ReactNode } from "react";

const params = new URLSearchParams(window.location.search);
if (params.has("signedout")) sessionStorage.setItem("demo-signed-out", "1");
if (params.has("signedin")) sessionStorage.removeItem("demo-signed-out");
const signedIn = () => sessionStorage.getItem("demo-signed-out") !== "1";

const user = {
  id: "demo-user",
  fullName: "Juan Dela Cruz",
  firstName: "Juan",
  imageUrl: "",
  primaryEmailAddress: { emailAddress: "juan@farm.local" },
};

const getToken = async () => "demo-token";

export const ClerkProvider: FC<{ children: ReactNode; [key: string]: unknown }> = ({ children }) => <>{children}</>;
export const useUser = () => ({ user: signedIn() ? user : null, isLoaded: true, isSignedIn: signedIn() });
export const useAuth = () => ({ getToken, isLoaded: true, isSignedIn: signedIn(), userId: signedIn() ? user.id : null });
export const SignedIn: FC<{ children: ReactNode }> = ({ children }) => (signedIn() ? <>{children}</> : null);
export const SignedOut: FC<{ children: ReactNode }> = ({ children }) => (signedIn() ? null : <>{children}</>);

const swap = (to: "in" | "out") => () => {
  if (to === "out") sessionStorage.setItem("demo-signed-out", "1");
  else sessionStorage.removeItem("demo-signed-out");
  window.location.assign("/");
};

export const SignOutButton: FC<{ children?: ReactNode }> = ({ children }) => <span onClick={swap("out")}>{children}</span>;
export const SignInButton: FC<{ children?: ReactNode; [key: string]: unknown }> = ({ children }) => <span onClick={swap("in")}>{children}</span>;
export const SignUpButton = SignInButton;

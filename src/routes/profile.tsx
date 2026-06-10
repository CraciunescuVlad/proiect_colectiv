import type { RouteObject } from "react-router-dom";
import ProfilePage from "../components/Profile/ProfilePage.tsx";

const profileRoute: RouteObject = {
    path: "/profile",
    element: <ProfilePage />,
};

export default profileRoute;
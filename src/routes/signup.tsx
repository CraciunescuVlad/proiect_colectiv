import type { RouteObject } from "react-router-dom";
import Signup from "../components/Signup/Signup";

const signupRoute: RouteObject = {
    path: "/signup",
    element: <Signup />,
};

export default signupRoute;
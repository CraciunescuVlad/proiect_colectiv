import type { RouteObject } from "react-router-dom";
import Statistics from "../components/Statistics/Statistics";

const statisticsRoute: RouteObject = {
    path: "/statistics",
    element: <Statistics />,
};

export default statisticsRoute;
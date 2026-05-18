import type { RouteObject } from "react-router-dom";
import IncidentPage from "../components/Incident/IncidentPage";

const incidentRoute: RouteObject = {
    path: "/incident/:id",
    element: <IncidentPage />,
};

export default incidentRoute;
import { Routes, Route } from "react-router-dom";
import { Layout } from "../components/layout/Layout";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import ProjectDetailPage from "../pages/ProjectDetailPage";
import GraphPage from "../pages/GraphPage";
import AgentPage from "../pages/AgentPage";
import SettingsPage from "../pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

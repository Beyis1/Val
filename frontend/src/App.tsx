import { Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Workshop from "@/pages/Workshop";
import Records from "@/pages/Records";
import Settings from "@/pages/Settings";
import Updates from "@/pages/Updates";
import Editor from "@/pages/Editor";
import Play from "@/pages/Play";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Workshop />} />
        <Route path="/favorites" element={<Workshop favorites />} />
        <Route path="/records" element={<Records />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/updates" element={<Updates />} />
      </Route>
      <Route path="/editor" element={<Editor />} />
      <Route path="/editor/:id" element={<Editor />} />
      <Route path="/play/:id" element={<Play />} />
    </Routes>
  );
}

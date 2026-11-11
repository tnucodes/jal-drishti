import { useEffect, useState } from "react";
import { AppStateProvider } from "./app-state";
import { StationForm } from "./components/forms/StationForm";
import { ReadingForm } from "./components/forms/ReadingForm";
import { Header, type Route } from "./components/Header";
import MapView from "./components/map/MapView";
import Sidebar from "./components/panel/Sidebar";
import { Methods } from "./pages/Methods";

function readRoute(): Route {
  return window.location.hash.startsWith("#/methods") ? "methods" : "map";
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  return (
    <AppStateProvider>
      <div className="flex h-full flex-col">
        <Header route={route} />
        <main className="relative flex min-h-0 flex-1">
          <Sidebar />
          {/* z-0 keeps Leaflet's own z-indexes inside the map, so the phone panel stays on top. */}
          <div className="relative z-0 min-w-0 flex-1">
            <MapView />
          </div>
          {/* The map stays mounted under the Methods page, so it keeps its view. */}
          {route === "methods" && (
            <div className="scroll-thin absolute inset-0 z-[1500] overflow-y-auto bg-ink-50">
              <Methods />
            </div>
          )}
        </main>
        <ReadingForm />
        <StationForm />
      </div>
    </AppStateProvider>
  );
}

import { useEffect, useState } from "react";
import { api } from "./api/client";
import LoginScreen from "./components/LoginScreen";

function App() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAuthStatus()
      .then((status) => {
        setAuthed(status.configured);
      })
      .catch(() => {
        setAuthed(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <h1 className="p-4 text-xl font-semibold">UniFi Firewall Analyser</h1>
      <p className="px-4 text-gray-600 dark:text-gray-400">
        Connected. Zone graph will render here.
      </p>
    </div>
  );
}

export default App;

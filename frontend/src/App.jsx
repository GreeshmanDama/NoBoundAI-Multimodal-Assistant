import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Home from "./pages/Home";
import getCurrentUser from "./features/getCurrentUser";
import { setUserData } from "./redux/userSlice";
import { Toaster } from "react-hot-toast";

function App() {
  const dispatch = useDispatch();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const user = await getCurrentUser();

        if (isMounted) {
          dispatch(setUserData(user));
        }
      } catch (error) {
        console.error("Session restoration failed:", error);

        if (isMounted) {
          dispatch(setUserData(null));
        }
      } finally {
        if (isMounted) {
          setSessionReady(true);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  if (!sessionReady) {
    return (
      <div className="relative flex h-dvh w-full items-center justify-center bg-black text-white overflow-hidden">
        {/* Ambient Background Glow */}
        <div className="absolute h-72 w-72 rounded-full bg-white/5 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Animated Ring Loader */}
          <div className="relative flex h-12 w-12 items-center justify-center">
            {/* Outer Glow Ring */}
            <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-white border-r-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
            {/* Inner Static Accent */}
            <div className="absolute inset-1.5 rounded-full border border-white/10" />
          </div>

          {/* Text */}
          <p className="text-xs font-light tracking-widest text-zinc-400 uppercase">
            Restoring your workspace...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#171717",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: "12px",
            fontSize: "13px",
            padding: "14px 16px",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fff",
            },
          },
        }}
      />

      <Home />
    </>
  );
}

export default App;

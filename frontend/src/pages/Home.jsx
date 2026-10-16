
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../utils/firebase";
import api from "../../utils/axios";
import { FcGoogle } from "react-icons/fc";
import { useSelector, useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";
import SideBar from "../components/SideBar";
import ChatArea from "../components/ChatArea";
import { useState } from "react";

function Home() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogin = async (token) => {
    try {
      const resData = await api.post("/api/auth/login", { token });
      dispatch(setUserData(resData.data));
    } catch (error) {
      console.error("Login error", error);
    }
  };

  const googleLogin = async () => {
    try {
      const data = await signInWithPopup(auth, googleProvider);
      const token = await data.user.getIdToken();
      await handleLogin(token);
    } catch (error) {
      console.error("Google login error", error);
    }
  };

  return (
    <div className="
      flex h-dvh w-full flex-row overflow-hidden
      bg-[#0d0f14] text-white
    ">
      {/* Sidebar */}
      <SideBar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main chat area */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ChatArea onOpenSidebar={() => setMobileOpen(true)} />
      </main>

      {/* Login overlay */}
      {!userData && (
        <div className="
          fixed inset-0 z-100
          flex items-center justify-center
          bg-black/60 p-4 backdrop-blur
        ">
          <div className="
            flex w-full max-w-85 flex-col gap-5
            rounded-2xl border border-white/8
            bg-[#13151c] p-6 sm:p-7
          ">
            <div className="flex flex-col gap-1">
              <h2 className="text-[17px] font-semibold tracking-tight text-slate-100">
                Welcome to NoBound AI
              </h2>
              <p className="text-[13px] text-slate-500">
                Please login to continue.
              </p>
            </div>

            <button
              type="button"
              onClick={googleLogin}
              className="
                flex w-full cursor-pointer items-center
                justify-center gap-3 rounded-xl
                border border-gray-300 bg-white py-2.5
                text-sm font-medium text-gray-800 shadow-sm
                transition-all duration-150
                hover:border-gray-400 hover:bg-gray-50
                hover:shadow-md active:bg-gray-100
                disabled:cursor-not-allowed
              "
            >
              <FcGoogle size={18} />
              Continue with Google
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;

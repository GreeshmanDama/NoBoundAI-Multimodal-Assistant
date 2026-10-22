import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../utils/firebase";
import api from "../../utils/axios";
// import { FcGoogle } from "react-icons/fc";
import { useSelector, useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";
import SideBar from "../components/SideBar";
import ChatArea from "../components/ChatArea";
import { useState } from "react";
import LoginPage from "../components/LoginPage";

function Home() {
  const { userData } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogin = async (token) => {
    const { data } = await api.post("/api/auth/login", { token });
    dispatch(setUserData(data));
  };

  const googleLogin = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const token = await result.user.getIdToken();

    await handleLogin(token);
  };

  return (
    <>
      {!userData ? (
        <LoginPage onLogin={googleLogin} />
      ) : (
        <div className="flex h-dvh w-full flex-row overflow-hidden bg-[#0d0f14] text-white">
          <SideBar
            mobileOpen={mobileOpen}
            onMobileClose={() => setMobileOpen(false)}
          />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ChatArea onOpenSidebar={() => setMobileOpen(true)} />
          </main>
        </div>
      )}
    </>
  );
}

export default Home;

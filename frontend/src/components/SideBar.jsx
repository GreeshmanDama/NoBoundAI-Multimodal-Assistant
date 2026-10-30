import {
  PanelLeftIcon,
  PanelRightIcon,
  PenSquare,
  Plus,
  LogOut,
  MessageSquare,
  // Sparkles,
  User,
  Coins,
  Trash2,
  X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { deleteConversation } from "../features/deleteConversation";
import { getConversation } from "../features/getConversation";
import logOut from "../features/logOut";

import {
  setConversations,
  setSelectedConversation,
  clearConversations,
} from "../redux/conversationSlice";

import { clearUser } from "../redux/userSlice";
import { setInputMessage } from "../redux/messageSlice";

import BillingDrawer from "./BillingDrawer";

function SideBar({ mobileOpen = false, onMobileClose = () => {} }) {
  const [collapsed, setCollapsed] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const dispatch = useDispatch();

  const { conversations = [], selectedConversation } = useSelector(
    (state) => state.conversation,
  );

  const { userData } = useSelector((state) => state.user);

  const userId = userData?._id || userData?.id || userData?.uid;

  useEffect(() => {
    if (!userId) {
      dispatch(clearConversations());
      dispatch(setSelectedConversation(null));
      return;
    }

    let cancelled = false;

    const loadConversations = async () => {
      try {
        const data = await getConversation();

        if (cancelled) return;

        const history = Array.isArray(data) ? data : [];

        dispatch(setConversations(history));
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading conversations:", error);
        }
      }
    };

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [dispatch, userId]);

  useEffect(() => {
    if (!userData) {
      dispatch(clearConversations());
      return;
    }

    let cancelled = false;

    const loadConversations = async () => {
      try {
        const data = await getConversation();

        if (cancelled) return;

        const history = Array.isArray(data) ? data : [];

        dispatch(setConversations(history));

        dispatch(setSelectedConversation(history[0] ?? null));
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading conversations:", error);
        }
      }
    };

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [dispatch, userData]);

  const createConv = () => {
    dispatch(setSelectedConversation(null));

    dispatch(setInputMessage(""));

    onMobileClose();
  };

  const handleLogout = async () => {
    try {
      await logOut();

      dispatch(clearConversations());
      dispatch(clearUser());
      dispatch(setInputMessage(""));

      onMobileClose();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleDeleteConversation = async (id) => {
    console.log("DELETE HANDLER CALLED:", id);

    if (deletingId) return;

    try {
      setDeletingId(id);

      const result = await deleteConversation(id);
      console.log("DELETE API RESPONSE:", result);

      const updatedConversations = conversations.filter(
        (conversation) => conversation._id !== id,
      );

      dispatch(setConversations(updatedConversations));

      if (selectedConversation?._id === id) {
        dispatch(setSelectedConversation(updatedConversations[0] ?? null));
        dispatch(setInputMessage(""));
      }
    } catch (error) {
      console.error(
        "DELETE FAILED:",
        error.response?.status,
        error.response?.data,
      );
    } finally {
      setDeletingId(null);
    }
  };

  const selectConversation = (conversation) => {
    dispatch(setInputMessage(""));
    dispatch(setSelectedConversation(conversation));
    onMobileClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close sidebar"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onMobileClose}
        className={`
          fixed inset-0 z-40 bg-black/65 backdrop-blur-sm
          transition-opacity duration-300 lg:hidden
          ${
            mobileOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }
        `}
      />

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex h-dvh flex-col overflow-hidden
          border-r border-white/10 bg-black
          scrollbar-none
      
          /* Mobile drawer: animate only the slide */
          transform-gpu
          transition-transform duration-300
          ease-[cubic-bezier(0.22,1,0.36,1)]
          motion-reduce:transition-none
      
          /* Desktop sidebar: animate only the width */
          md:relative md:inset-auto md:z-auto
          md:h-full md:shrink-0
          md:transition-[width]
          md:duration-300
          md:ease-[cubic-bezier(0.22,1,0.36,1)]
      
          ${collapsed ? "md:w-18" : "md:w-90"}

          w-[85%]
      
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
        {/* Header */}
        <div
          className={`
            flex h-16 shrink-0 items-center border-b border-white/10
            ${collapsed ? "justify-center px-2" : "justify-between px-4"}
          `}
        >
          {!collapsed && (
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="
        flex h-9 w-9 shrink-0 items-center justify-center
        overflow-hidden rounded-xl
      "
              >
                <img
                  src="/noboundglobe.svg"
                  alt="NoBound AI Logo"
                  className="h-9 w-9 object-contain"
                />
              </div>

              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
                  NoBound AI
                </h1>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-neutral-500">
                  Your AI workspace
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="
              hidden h-9 w-9 shrink-0 items-center justify-center
              rounded-lg text-neutral-400
              transition-colors duration-150
              hover:bg-white/10 hover:text-white
              active:scale-95
              focus-visible:outline-none
              focus-visible:ring-1 focus-visible:ring-white/30
              lg:flex
            "
          >
            {collapsed ? (
              <PanelRightIcon size={19} strokeWidth={1.7} />
            ) : (
              <PanelLeftIcon size={18} strokeWidth={1.7} />
            )}
          </button>

          {/* Mobile close control */}
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close sidebar"
            className="
              flex h-9 w-9 shrink-0 items-center justify-center
              rounded-lg text-neutral-400 transition-colors
              hover:bg-white/10 hover:text-white lg:hidden
            "
          >
            <X size={19} />
          </button>
        </div>

        {/* New conversation */}
        <div className={collapsed ? "px-3 py-4" : "px-3.5 py-4"}>
          <button
            type="button"
            onClick={createConv}
            title={collapsed ? "New chat" : undefined}
            className={`
    flex min-h-10 w-full items-center rounded-xl
    border border-white/15 bg-white text-black
    transition-colors hover:bg-neutral-200
    active:scale-[0.99]
    ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
  `}
          >
            <Plus size={18} strokeWidth={2} />

            {!collapsed && (
              <span className="text-[13px] font-semibold">New chat</span>
            )}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={createConv}
              className="
                mt-1.5 flex min-h-9 w-full items-center gap-3
                rounded-lg px-3 text-neutral-400
                transition-colors hover:bg-white/6
                hover:text-white
              "
            >
              <PenSquare size={16} strokeWidth={1.7} />
              <span className="text-xs">Start a conversation</span>
            </button>
          )}
        </div>

        {/* Conversation history */}
        <div
          className="
            min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto
            overscroll-contain px-2.5 pb-3
            [scrollbar-color:#333_transparent]
            scrollbar-thin
          "
        >
          {!collapsed && (
            <div className="mb-2 flex items-center justify-between px-2 pt-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
                Recent chats
              </span>

              {conversations.length > 0 && (
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-500">
                  {conversations.length}
                </span>
              )}
            </div>
          )}

          {conversations.length === 0 ? (
            <div
              className={`
                flex flex-col items-center px-2 pt-10 text-center
                ${collapsed ? "pt-6" : ""}
              `}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/3">
                <MessageSquare
                  size={17}
                  strokeWidth={1.5}
                  className="text-neutral-500"
                />
              </div>

              {!collapsed && (
                <>
                  <p className="text-xs font-medium text-neutral-300">
                    No conversations yet
                  </p>
                  <p className="mt-1.5 max-w-48 text-[11px] leading-relaxed text-neutral-600">
                    Start chatting and your conversations will appear here.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => {
                const isSelected =
                  selectedConversation?._id === conversation._id;

                const isDeleting = deletingId === conversation._id;

                return (
                  <div
                    key={conversation._id}
                    className={`
                      group relative flex min-w-0 items-center gap-1
                      rounded-lg border transition-colors duration-150
                      ${
                        isSelected
                          ? "border-white/12 bg-white/[0.07] text-white"
                          : "border-transparent text-neutral-400 hover:border-white/5 hover:bg-white/4 hover:text-neutral-100"
                      }
                    `}
                  >
                    {isSelected && (
                      <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-white" />
                    )}

                    {/* Conversation selection button */}
                    <button
                      type="button"
                      onClick={() => selectConversation(conversation)}
                      title={
                        collapsed
                          ? conversation.title || "New conversation"
                          : undefined
                      }
                      aria-current={isSelected ? "page" : undefined}
                      className={`
                        flex min-h-10 min-w-0 flex-1 items-center gap-2.5
                        overflow-hidden py-2.5 text-left
                        ${collapsed ? "justify-center px-0" : "pl-3 pr-1"}
                      `}
                    >
                      <MessageSquare
                        size={16}
                        strokeWidth={1.7}
                        className={`
                          shrink-0
                          ${
                            isSelected
                              ? "text-white"
                              : "text-neutral-500 group-hover:text-neutral-300"
                          }
                        `}
                      />

                      {!collapsed && (
                        <span className="min-w-0 flex-1 truncate text-xs font-medium">
                          {conversation.title || "New conversation"}
                        </span>
                      )}
                    </button>

                    {/* Separate delete button: no nested buttons */}
                    {!collapsed && (
                      <button
                        type="button"
                        disabled={Boolean(deletingId)}
                        onClick={() =>
                          handleDeleteConversation(conversation._id)
                        }
                        title="Delete conversation"
                        aria-label={`Delete ${conversation.title || "conversation"}`}
                        className="
                          mr-1 flex h-8 w-8 shrink-0 items-center
                          justify-center rounded-md
                          text-neutral-500 transition-colors
                          hover:bg-red-500/10 hover:text-red-400
                          focus-visible:outline-none
                          focus-visible:ring-1 focus-visible:ring-red-400/60
                          sm:opacity-0 sm:group-hover:opacity-100
                          sm:focus-visible:opacity-100
                          disabled:cursor-wait disabled:opacity-40
                        "
                      >
                        {isDeleting ? (
                          <span
                            className="
                              h-3.5 w-3.5 animate-spin rounded-full
                              border border-neutral-500 border-t-white
                            "
                          />
                        ) : (
                          <Trash2 size={14} strokeWidth={1.7} />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom section */}
        <div className="shrink-0 border-t border-white/8 p-3">
          {/* Billing / current plan */}
          {!collapsed && (
            <div className="mb-3 rounded-xl border border-white/8 bg-white/2.5 p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-neutral-300">
                    Current plan
                  </p>
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    Your AI workspace
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBilling(true)}
                  title="Manage billing"
                  aria-label="Manage billing"
                  className="
                    flex h-8 w-8 shrink-0 items-center justify-center
                    rounded-lg text-neutral-400 transition-colors
                    hover:bg-white/[0.07] hover:text-amber-200
                  "
                >
                  <Coins size={17} strokeWidth={1.7} />
                </button>

                <span className="rounded-md border border-white/10 bg-white/4 px-2 py-1 text-[9px] font-semibold tracking-widest text-neutral-300">
                  {userData?.plan}
                </span>
              </div>
            </div>
          )}

          {/* User profile */}
          <div
            className={`
              flex min-w-0 items-center gap-2.5 rounded-xl
              border border-transparent p-2 transition-colors
              hover:border-white/[0.07] hover:bg-white/[0.035]
              ${collapsed ? "justify-center" : ""}
            `}
          >
            <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-neutral-900">
              {userData?.avatar && !imgError ? (
                <img
                  src={userData?.avatar}
                  alt={userData?.name || "User"}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User
                    size={17}
                    strokeWidth={1.6}
                    className="text-neutral-400"
                  />
                </div>
              )}
            </div>

            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-neutral-100">
                    {userData?.name || "User"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                    {userData?.email || "No email"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  title="Log out"
                  aria-label="Log out"
                  className="
                    flex h-8 w-8 shrink-0 items-center justify-center
                    rounded-lg text-neutral-500 transition-colors
                    hover:bg-white/8 hover:text-white
                    focus-visible:outline-none
                    focus-visible:ring-1 focus-visible:ring-white/30
                  "
                >
                  <LogOut size={15} strokeWidth={1.8} />
                </button>
              </>
            )}
          </div>

          {collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              title="Log out"
              aria-label="Log out"
              className="
                mt-2 flex h-9 w-full items-center justify-center
                rounded-lg text-neutral-500 transition-colors
                hover:bg-white/[0.07] hover:text-white
                focus-visible:outline-none
                focus-visible:ring-1 focus-visible:ring-white/30
              "
            >
              <LogOut size={16} strokeWidth={1.7} />
            </button>
          )}
        </div>

        {/* Billing drawer */}
        <BillingDrawer
          open={showBilling}
          onClose={() => setShowBilling(false)}
        />
      </aside>
    </>
  );
}

export default SideBar;

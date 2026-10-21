import { Menu } from "lucide-react";

function Nav({ onOpenSidebar }) {
  return (
    <div className="fixed top-2 left-2 z-40 lg:hidden md:hidden">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open sidebar"
        title="Open sidebar"
        className="flex items-center justify-center bg-black rounded-lg p-2 text-white transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <Menu size={25} strokeWidth={1.8} />
      </button>
    </div>
  );
}

export default Nav;
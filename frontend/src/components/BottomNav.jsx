import { Home } from "lucide-react";

export default function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg safe-area-pb">
      <div className="max-w-md mx-auto px-4 py-3">
        <div className="flex justify-center">
          <div className="flex flex-col items-center text-pink-600">
            <Home size={24} />
            <span className="text-xs mt-1 font-medium">Home</span>
          </div>
        </div>
      </div>
    </div>
  );
}

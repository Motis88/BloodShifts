import React from "react";
import ShiftForm from "./components/ShiftForm.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-100 dark:from-zinc-900 dark:to-indigo-900 transition-colors duration-500 font-[Varela_Round,Arial,sans-serif]">
      <div className="max-w-6xl mx-auto px-2 md:px-0">
        <ShiftForm />
      </div>
    </div>
  );
}

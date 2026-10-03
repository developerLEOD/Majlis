import React, { useState } from 'react';

interface ProfileScreenProps {
  userName: string;
  onUpdateUserName: (name: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userName,
  onUpdateUserName,
}) => {
  const [nameInput, setNameInput] = useState(userName);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onUpdateUserName(nameInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F5F2EB] p-6 lg:p-12 select-none space-y-6 max-w-xl">
      <div className="border-b border-[#E6DFD5] pb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
          Account
        </span>
        <h2 className="text-2xl font-bold text-[#3C230B] mt-0.5">
          Profile
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#FFFCF5] border border-[#E6DFD5] rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#3C230B] block mb-1.5">
            Your Display Name
          </label>
          <input
            type="text"
            required
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full bg-white border border-[#D9D0C3] rounded-xl px-3.5 py-2.5 text-xs text-[#241710] focus:outline-none focus:border-[#3C230B]"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-emerald-700 font-medium">
            {saved && '✓ Name updated'}
          </span>
          <button
            type="submit"
            className="px-4 py-2 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] rounded-xl text-xs font-semibold transition"
          >
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
};

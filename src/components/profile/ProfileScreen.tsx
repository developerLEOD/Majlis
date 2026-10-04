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
    <div className="flex-1 overflow-y-auto bg-[#FFFCF5] p-6 lg:p-10 select-none space-y-6 max-w-xl">
      <div className="border-b border-[#E6DFD5] pb-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[#8E7E73] mb-1">
          Account
        </div>
        <h1 className="text-2xl font-semibold text-[#1C1917] tracking-tight">
          User Profile
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#F5F2EB] border border-[#E6DFD5] rounded-sm p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-[#1C1917] block mb-1.5">
            Your Display Name
          </label>
          <input
            type="text"
            required
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full bg-[#FFFCF5] border border-[#D9D0C3] rounded-sm px-3 py-2 text-xs text-[#1C1917] focus:outline-none focus:border-[#3C230B]"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-emerald-800 font-medium">
            {saved && '✓ Name updated'}
          </span>
          <button
            type="submit"
            className="px-4 py-2 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] rounded-sm text-xs font-medium transition-colors"
          >
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
};

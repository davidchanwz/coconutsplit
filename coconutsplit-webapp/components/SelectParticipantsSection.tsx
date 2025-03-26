import React from 'react';
import { User } from '../lib/types';

interface SelectParticipantsSectionProps {
  members: User[];
  selectedParticipants: string[];
  setSelectedParticipants: (participants: string[]) => void;
}

export function SelectParticipantsSection({
  members,
  selectedParticipants,
  setSelectedParticipants,
}: SelectParticipantsSectionProps) {
  const toggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      setSelectedParticipants(selectedParticipants.filter(id => id !== userId));
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

  const selectAll = () => {
    setSelectedParticipants(members.map(member => member.uuid));
  };

  const deselectAll = () => {
    setSelectedParticipants([]);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-medium text-white">Select Participants</h2>
        <div className="space-x-2">
          <button
            type="button"
            onClick={selectAll}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {members.map((member) => (
          <div 
            key={member.uuid} 
            className={`p-3 rounded-md cursor-pointer flex items-center gap-2 border ${
              selectedParticipants.includes(member.uuid) 
                ? 'bg-blue-900 border-blue-600' 
                : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
            }`}
            onClick={() => toggleParticipant(member.uuid)}
          >
            <input
              type="checkbox"
              checked={selectedParticipants.includes(member.uuid)}
              onChange={() => {}} // Handled by parent div click
              className="form-checkbox h-5 w-5 text-blue-600 rounded"
            />
            <span className="text-white">{member.username}</span>
          </div>
        ))}
      </div>
      
      <div className="text-sm text-gray-400">
        {selectedParticipants.length} of {members.length} participants selected
      </div>
    </div>
  );
}

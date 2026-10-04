import React from 'react';
import { Participant } from '../../types/meeting';
import { VideoTile } from '../VideoTile';

interface HoneycombGridProps {
  participants: Participant[];
  mirrorVideo: boolean;
  onPinUser: (userId: string) => void;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

export const HoneycombGrid: React.FC<HoneycombGridProps> = ({
  participants,
  mirrorVideo,
  onPinUser,
  videoElementsRef,
}) => {
  if (participants.length === 0) {
    return null;
  }

  // Determine ideal row pattern & tile size based on total participant count
  let maxPerRow = 3;
  let sizeClasses = 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36';
  let overlapClass = '-mt-6 sm:-mt-7 md:-mt-8';

  if (participants.length <= 2) {
    maxPerRow = 2;
    sizeClasses = 'w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48';
    overlapClass = '-mt-8 sm:-mt-10 md:-mt-11';
  } else if (participants.length <= 4) {
    maxPerRow = 2;
    sizeClasses = 'w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40';
    overlapClass = '-mt-7 sm:-mt-8 md:-mt-9';
  } else if (participants.length <= 7) {
    maxPerRow = 3;
    sizeClasses = 'w-28 h-28 sm:w-32 sm:h-32 md:w-36 md:h-36';
    overlapClass = '-mt-6 sm:-mt-7 md:-mt-8';
  } else {
    maxPerRow = 4;
    sizeClasses = 'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32';
    overlapClass = '-mt-5 sm:-mt-6 md:-mt-7';
  }

  // Build rows that alternate between maxPerRow and (maxPerRow - 1)
  const rows: Participant[][] = [];
  let index = 0;
  let isWideRow = true;

  // For 3 participants: 2 in row 0, 1 in row 1
  if (participants.length === 3) {
    rows.push(participants.slice(0, 2));
    rows.push(participants.slice(2, 3));
  } else {
    while (index < participants.length) {
      const takeCount = isWideRow ? maxPerRow : Math.max(1, maxPerRow - 1);
      const rowSlice = participants.slice(index, index + takeCount);
      rows.push(rowSlice);
      index += takeCount;
      isWideRow = !isWideRow;
    }
  }

  return (
    <div className="w-full flex flex-col items-center justify-center py-4 px-2 select-none">
      {rows.map((row, rowIndex) => (
        <div
          key={`honeycomb-row-${rowIndex}`}
          className={`flex items-center justify-center gap-2 sm:gap-3 transition-all ${
            rowIndex > 0 ? overlapClass : ''
          }`}
        >
          {row.map((p) => (
            <div
              key={p.id}
              className={`${sizeClasses} shrink-0 transition-transform duration-200 hover:scale-105 hover:z-30 relative`}
            >
              <VideoTile
                participant={p}
                isLocal={p.isLocal}
                mirror={mirrorVideo}
                forceShape="honeycomb"
                onTogglePin={() => onPinUser(p.id)}
                videoRefCallback={(el) => {
                  if (el) videoElementsRef.current.set(p.id, el);
                  else videoElementsRef.current.delete(p.id);
                }}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

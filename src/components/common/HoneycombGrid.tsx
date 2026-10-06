import React from 'react';
import { Participant } from '../../types/meeting';
import { VideoTile } from '../VideoTile';

interface HoneycombGridProps {
  participants: Participant[];
  mirrorVideo: boolean;
  canModerate?: boolean;
  onMuteUser?: (userId: string) => void;
  onStopVideoUser?: (userId: string) => void;
  onPinUser: (userId: string) => void;
  videoElementsRef: React.MutableRefObject<Map<string, HTMLVideoElement>>;
}

export const HoneycombGrid: React.FC<HoneycombGridProps> = ({
  participants,
  mirrorVideo,
  canModerate,
  onMuteUser,
  onStopVideoUser,
  onPinUser,
  videoElementsRef,
}) => {
  if (participants.length === 0) {
    return null;
  }

  // Determine ideal row pattern & tile size based on total participant count
  let maxPerRow = 3;
  let sizeClasses = 'w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36';
  let overlapClass = '-mt-4 sm:-mt-6 md:-mt-7';

  if (participants.length <= 2) {
    maxPerRow = 2;
    sizeClasses = 'w-28 h-28 sm:w-40 sm:h-40 md:w-48 md:h-48';
    overlapClass = '-mt-5 sm:-mt-8 md:-mt-9';
  } else if (participants.length <= 4) {
    maxPerRow = 2;
    sizeClasses = 'w-24 h-24 sm:w-32 sm:h-32 md:w-38 md:h-38';
    overlapClass = '-mt-4 sm:-mt-6 md:-mt-7';
  } else if (participants.length <= 7) {
    maxPerRow = 3;
    sizeClasses = 'w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32';
    overlapClass = '-mt-4 sm:-mt-5 md:-mt-6';
  } else {
    maxPerRow = 4;
    sizeClasses = 'w-18 h-18 sm:w-24 sm:h-24 md:w-28 md:h-28';
    overlapClass = '-mt-3 sm:-mt-4 md:-mt-5';
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
          style={{ zIndex: rows.length - rowIndex }}
        >
          {row.map((p, colIndex) => {
            const overallIndex = participants.findIndex((item) => item.id === p.id);
            const themeIndex = overallIndex >= 0 ? overallIndex : rowIndex * 3 + colIndex;

            return (
              <div
                key={p.id}
                className={`${sizeClasses} shrink-0 aspect-square transition-transform duration-200 hover:scale-105 hover:z-50 relative`}
              >
                <VideoTile
                  participant={p}
                  isLocal={p.isLocal}
                  mirror={mirrorVideo}
                  canModerate={canModerate}
                  onMuteUser={onMuteUser}
                  onStopVideoUser={onStopVideoUser}
                  forceShape="honeycomb"
                  themeIndex={themeIndex}
                  onTogglePin={() => onPinUser(p.id)}
                  videoRefCallback={(el) => {
                    if (el) videoElementsRef.current.set(p.id, el);
                    else videoElementsRef.current.delete(p.id);
                  }}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

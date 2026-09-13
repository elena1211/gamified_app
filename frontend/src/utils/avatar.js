// Avatar utility functions for level-based avatar progression
export const getAvatarStage = (level) => {
  if (level < 5) return 1;
  if (level < 10) return 2;
  if (level < 30) return 3;
  if (level < 50) return 4;
  return 5;
};

export const getAvatarSrc = (level) => {
  const stage = getAvatarStage(level);
  return `/avatars/avatar_stage_${stage}.png`;
};

export const getAvatarTitle = (level) => {
  const stage = getAvatarStage(level);
  const titles = {
    1: 'Lost Novice',
    2: 'Hopeful Beginner',
    3: 'Disciplined Warrior',
    4: 'Seeker of Purpose',
    5: 'Queen'
  };
  return titles[stage] || 'Unknown';
};


// Calculate EXP required for each level (exponential growth)
export const getExpForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.3, level - 1));
};




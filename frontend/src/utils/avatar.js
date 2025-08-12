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

// Get next level milestone for progression display
export const getNextMilestone = (level) => {
  if (level < 5) return 5;
  if (level < 10) return 10;
  if (level < 30) return 30;
  if (level < 50) return 50;
  return null; // Max level reached
};

// Calculate EXP required for each level (exponential growth)
export const getExpForLevel = (level) => {
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(1.3, level - 1));
};

// Calculate current level from total EXP
export const getLevelFromExp = (totalExp) => {
  let level = 1;

  while (level < 100 && totalExp >= getExpForLevel(level + 1)) {
    level++;
  }

  return level;
};

// Calculate progress to next level
export const getLevelProgress = (totalExp) => {
  const currentLevel = getLevelFromExp(totalExp);
  const currentLevelExp = getExpForLevel(currentLevel);
  const nextLevelExp = getExpForLevel(currentLevel + 1);

  const progressExp = totalExp - currentLevelExp;
  const expNeeded = nextLevelExp - currentLevelExp;

  return {
    currentLevel,
    progressExp,
    expNeeded,
    progressPercent: Math.min(100, Math.floor((progressExp / expNeeded) * 100))
  };
};

// Calculate EXP gained from completing a task
export const getTaskExp = (task) => {
  // Base EXP: base points + difficulty bonus
  const baseExp = 10 + (task.difficulty || 1) * 5;

  // Different task type bonuses
  if (task.is_random) {
    // Time-limited tasks give 50% more EXP
    return Math.floor(baseExp * 1.5);
  }

  return baseExp;
};

// Check if leveled up
export const checkLevelUp = (oldExp, newExp) => {
  const oldLevel = getLevelFromExp(oldExp);
  const newLevel = getLevelFromExp(newExp);

  return {
    leveledUp: newLevel > oldLevel,
    oldLevel,
    newLevel,
    levelsGained: newLevel - oldLevel,
    oldStage: getAvatarStage(oldLevel),
    newStage: getAvatarStage(newLevel),
    stageChanged: getAvatarStage(newLevel) > getAvatarStage(oldLevel)
  };
};

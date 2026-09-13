import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAvatarStage, getAvatarSrc, getAvatarThumbSrc, getAvatarTitle, getExpForLevel } from '../avatar';

describe('getAvatarStage', () => {
  // Each pair sits either side of a threshold, so moving a boundary by one
  // level fails here rather than showing a player the wrong avatar.
  it.each([
    [1, 1], [4, 1],
    [5, 2], [9, 2],
    [10, 3], [29, 3],
    [30, 4], [49, 4],
    [50, 5], [100, 5],
  ])('level %i is stage %i', (level, stage) => {
    expect(getAvatarStage(level)).toBe(stage);
  });
});

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../public');

describe('getAvatarSrc', () => {
  it.each([1, 5, 10, 30, 50])('points at an image that exists for level %i', (level) => {
    const src = getAvatarSrc(level);
    // A renamed or missing file would otherwise surface only as a broken image.
    expect(existsSync(resolve(publicDir, src.slice(1)))).toBe(true);
  });
});

describe('getAvatarThumbSrc', () => {
  it.each([1, 5, 10, 30, 50])('points at a small copy that exists for level %i', (level) => {
    expect(existsSync(resolve(publicDir, getAvatarThumbSrc(level).slice(1)))).toBe(true);
  });
});

describe('getAvatarTitle', () => {
  it('gives every stage its own title', () => {
    const titles = [1, 5, 10, 30, 50].map(getAvatarTitle);
    expect(titles).toEqual([
      'Lost Novice', 'Hopeful Beginner', 'Disciplined Warrior', 'Seeker of Purpose', 'Queen',
    ]);
  });
});

describe('getExpForLevel', () => {
  // Values generated from get_exp_for_level in backend/views.py. The server
  // decides the level and the client draws the EXP bar, so if the two formulas
  // drift the bar shows progress towards a level the server will not grant.
  // 99 and 100 are included because that is where the values are largest and a
  // one-bit difference between V8's and CPython's pow() would first show.
  it.each([
    [0, 0],
    [1, 0],
    [2, 130],
    [3, 169],
    [5, 285],
    [10, 1060],
    [20, 14619],
    [50, 38302247],
    [99, 14670621958378],
    [100, 19071808545892],
  ])('level %i needs %i EXP, matching the backend', (level, exp) => {
    expect(getExpForLevel(level)).toBe(exp);
  });
});

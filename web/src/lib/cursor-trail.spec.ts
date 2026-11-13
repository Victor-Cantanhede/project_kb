import { describe, expect, it } from 'vitest';
import { updateCursorTrail } from './cursor-trail.js';

describe('updateCursorTrail', () => {
  it('appends nextCursor when moving from initial page', () => {
    const prev: readonly (string | null)[] = [null];
    const updated = updateCursorTrail(prev, 0, 'cur_page_2');
    expect(updated).toEqual([null, 'cur_page_2']);
  });

  it('keeps cursor trail unchanged if nextCursor already matches', () => {
    const prev = [null, 'cur_page_2'];
    const updated = updateCursorTrail(prev, 0, 'cur_page_2');
    expect(updated).toBe(prev);
  });

  it('appends nextCursor on multi-page navigation', () => {
    const prev = [null, 'cur_page_2'];
    const updated = updateCursorTrail(prev, 1, 'cur_page_3');
    expect(updated).toEqual([null, 'cur_page_2', 'cur_page_3']);
  });

  it('truncates subsequent trail when nextCursor is null (last page reached)', () => {
    const prev = [null, 'cur_page_2', 'cur_page_3', 'cur_page_4'];
    const updated = updateCursorTrail(prev, 1, null);
    expect(updated).toEqual([null, 'cur_page_2']);
  });

  it('preserves existing trail if on last element and nextCursor is null', () => {
    const prev = [null, 'cur_page_2'];
    const updated = updateCursorTrail(prev, 1, null);
    expect(updated).toBe(prev);
  });

  it('overwrites divergent history when a new nextCursor arrives for the same pageIdx', () => {
    const prev = [null, 'old_cur_2', 'old_cur_3'];
    const updated = updateCursorTrail(prev, 0, 'new_cur_2');
    expect(updated).toEqual([null, 'new_cur_2']);
  });
});

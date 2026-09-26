import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from 'lucide-react';
import { API_ENDPOINTS, apiRequest } from '../config/api.js';
import { COMPLETION_TYPES, DIRECTIONS } from '../utils/pathFormat.js';

const MIN_MILESTONES = 3;
const MAX_MILESTONES = 5;
const MAX_QUESTS_PER_MILESTONE = 2;

const ATTRIBUTES = ['intelligence', 'discipline', 'energy', 'social', 'wellness'];

const blankMilestone = () => ({
  title: '',
  description: '',
  completion_type: 'outcome',
  target_count: '',
  target_value: '',
  target_direction: 'at_least',
  unit: '',
});

const blankDraft = () => Array.from({ length: MIN_MILESTONES }, blankMilestone);

// The System's reply only carries the fields each milestone's type uses, so
// the rest are filled in blank for the form to edit.
const toFormMilestone = (milestone) => ({
  ...blankMilestone(),
  ...milestone,
  target_count: milestone.target_count ?? '',
  target_value: milestone.target_value ?? '',
  target_direction: milestone.target_direction ?? 'at_least',
  unit: milestone.unit ?? '',
  description: milestone.description ?? '',
});

// The reverse: send only what the milestone's type needs, so switching type
// in the form doesn't carry an abandoned target along with it.
const toPayloadMilestone = (milestone) => {
  const base = { title: milestone.title.trim(), description: milestone.description.trim() };
  if (milestone.completion_type === 'cumulative') {
    return { ...base, completion_type: 'cumulative', target_count: Number(milestone.target_count) };
  }
  if (milestone.completion_type === 'measurable') {
    return {
      ...base,
      completion_type: 'measurable',
      target_value: String(milestone.target_value).trim(),
      target_direction: milestone.target_direction,
      unit: milestone.unit.trim(),
    };
  }
  return { ...base, completion_type: 'outcome' };
};

export default function PathDraftEditor({ onConfirmed, onCancel, currentGoal }) {
  const [step, setStep] = useState('goal');
  // Drafting a new path keeps the goal already set, so it doesn't have to be
  // typed again to change the milestones under it.
  const [goal, setGoal] = useState({
    title: currentGoal?.title ?? '',
    description: currentGoal?.description ?? '',
  });
  const [milestones, setMilestones] = useState([]);
  const [quests, setQuests] = useState([]);
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const headingRef = useRef(null);

  // Each step replaces the button that opened it, so focus would otherwise
  // fall back to the top of the page.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const editMilestone = (index, changes) => {
    setMilestones((current) =>
      current.map((milestone, i) => (i === index ? { ...milestone, ...changes } : milestone)),
    );
  };

  const moveMilestone = (index, by) => {
    setMilestones((current) => {
      const moved = [...current];
      [moved[index], moved[index + by]] = [moved[index + by], moved[index]];
      return moved;
    });
    // Quests point at a milestone by its place in the list, so they move with it.
    setQuests((current) =>
      current.map((quest) => {
        if (quest.milestone === index + 1) return { ...quest, milestone: index + 1 + by };
        if (quest.milestone === index + 1 + by) return { ...quest, milestone: index + 1 };
        return quest;
      }),
    );
  };

  const removeMilestone = (index) => {
    setMilestones((current) => current.filter((_, i) => i !== index));
    setQuests((current) =>
      current
        .filter((quest) => quest.milestone !== index + 1)
        .map((quest) => (quest.milestone > index + 1 ? { ...quest, milestone: quest.milestone - 1 } : quest)),
    );
  };

  const questsFor = (position) => quests.filter((quest) => quest.milestone === position).length;

  const askTheSystem = async () => {
    setAsking(true);
    setError('');
    setNotice('');
    try {
      const { data } = await apiRequest(API_ENDPOINTS.pathProposal, {
        method: 'POST',
        body: JSON.stringify({
          goal_title: goal.title.trim(),
          goal_description: goal.description.trim(),
        }),
      });
      setGoal({
        title: data.draft.goal.title,
        description: data.draft.goal.description ?? '',
      });
      setMilestones(data.draft.milestones.map(toFormMilestone));
      setQuests(data.draft.daily_quests ?? []);
      setStep('edit');
    } catch (err) {
      // No sample path stands in for a draft the System didn't write: the
      // user gets empty milestones and the System's own reason for it.
      if (err.status === 400) {
        setError(err.message);
      } else {
        setMilestones(blankDraft());
        setQuests([]);
        setNotice(err.message);
        setStep('edit');
      }
    } finally {
      setAsking(false);
    }
  };

  const writeItMyself = () => {
    setError('');
    setNotice('');
    setMilestones(blankDraft());
    setQuests([]);
    setStep('edit');
  };

  const confirmPath = async () => {
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const { data } = await apiRequest(API_ENDPOINTS.goalPath, {
        method: 'PUT',
        body: JSON.stringify({
          goal: { title: goal.title.trim(), description: goal.description.trim() },
          milestones: milestones.map(toPayloadMilestone),
          daily_quests: quests
            .filter((quest) => quest.title.trim())
            .map((quest) => ({ ...quest, title: quest.title.trim() })),
        }),
      });
      onConfirmed(data.path);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'goal') {
    return (
      <div className="rpg-window px-5 py-5">
        <h2 className="rpg-header -mx-5 -mt-5 mb-4" tabIndex={-1} ref={headingRef}>Set your goal</h2>

        <label htmlFor="goal-title" className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
          What do you want to reach?
        </label>
        <input
          id="goal-title"
          value={goal.title}
          onChange={(e) => setGoal({ ...goal, title: e.target.value })}
          maxLength={150}
          autoComplete="off"
          placeholder="First software engineer job"
          className="rpg-input w-full mb-3"
        />

        <label htmlFor="goal-description" className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
          Anything the System should know (optional)
        </label>
        <textarea
          id="goal-description"
          value={goal.description}
          onChange={(e) => setGoal({ ...goal, description: e.target.value })}
          maxLength={500}
          rows={3}
          className="rpg-input w-full resize-none mb-4"
        />

        {error && (
          <p className="text-sm mb-3" style={{ color: 'var(--accent-rust)' }} role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={askTheSystem}
            disabled={asking || !goal.title.trim()}
            className="rpg-btn-primary w-full flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            {asking ? 'The System is drafting your path…' : 'Ask the System for a path'}
          </button>
          <button onClick={writeItMyself} disabled={asking} className="rpg-btn-secondary w-full">
            Write it myself
          </button>
          {onCancel && (
            <button onClick={onCancel} disabled={asking} className="text-xs text-ink-mute underline mt-1">
              Not now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p className="rpg-window-light px-4 py-3 text-sm text-ink-soft" role="status">
          {notice}
        </p>
      )}

      <div className="rpg-window px-5 py-4">
        <h2 className="rpg-header -mx-5 -mt-4 mb-3" tabIndex={-1} ref={headingRef}>Your goal</h2>
        <label htmlFor="draft-goal-title" className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
          Goal
        </label>
        <input
          id="draft-goal-title"
          value={goal.title}
          onChange={(e) => setGoal({ ...goal, title: e.target.value })}
          maxLength={150}
          autoComplete="off"
          className="rpg-input w-full"
        />
      </div>

      {milestones.map((milestone, index) => (
        <div key={index} className="rpg-window px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm text-ink">Milestone {index + 1}</h3>
            <div className="flex gap-1">
              <button
                onClick={() => moveMilestone(index, -1)}
                disabled={index === 0}
                className="rpg-btn-secondary disabled:opacity-40"
                aria-label={`Move milestone ${index + 1} earlier`}
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => moveMilestone(index, 1)}
                disabled={index === milestones.length - 1}
                className="rpg-btn-secondary disabled:opacity-40"
                aria-label={`Move milestone ${index + 1} later`}
              >
                <ArrowDown size={14} />
              </button>
              <button
                onClick={() => removeMilestone(index)}
                disabled={milestones.length <= MIN_MILESTONES}
                className="rpg-btn-secondary disabled:opacity-40"
                aria-label={`Remove milestone ${index + 1}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          <label htmlFor={`milestone-title-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
            Title
          </label>
          <input
            id={`milestone-title-${index}`}
            value={milestone.title}
            onChange={(e) => editMilestone(index, { title: e.target.value })}
            maxLength={150}
            autoComplete="off"
            className="rpg-input w-full mb-3"
          />

          <label htmlFor={`milestone-description-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
            Description (optional)
          </label>
          <textarea
            id={`milestone-description-${index}`}
            value={milestone.description}
            onChange={(e) => editMilestone(index, { description: e.target.value })}
            maxLength={500}
            rows={2}
            className="rpg-input w-full resize-none mb-3"
          />

          <label htmlFor={`milestone-type-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
            How it counts as reached
          </label>
          <select
            id={`milestone-type-${index}`}
            value={milestone.completion_type}
            onChange={(e) => editMilestone(index, { completion_type: e.target.value })}
            className="rpg-select w-full mb-3"
          >
            {COMPLETION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>

          {milestone.completion_type === 'cumulative' && (
            <>
              <label htmlFor={`milestone-count-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
                How many completions
              </label>
              <input
                id={`milestone-count-${index}`}
                type="number"
                min="1"
                max="1000"
                value={milestone.target_count}
                onChange={(e) => editMilestone(index, { target_count: e.target.value })}
                className="rpg-input w-full"
              />
            </>
          )}

          {milestone.completion_type === 'measurable' && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label htmlFor={`milestone-direction-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
                  Direction
                </label>
                <select
                  id={`milestone-direction-${index}`}
                  value={milestone.target_direction}
                  onChange={(e) => editMilestone(index, { target_direction: e.target.value })}
                  className="rpg-select w-full"
                >
                  {DIRECTIONS.map((direction) => (
                    <option key={direction.value} value={direction.value}>{direction.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor={`milestone-value-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
                  Number
                </label>
                <input
                  id={`milestone-value-${index}`}
                  value={milestone.target_value}
                  onChange={(e) => editMilestone(index, { target_value: e.target.value })}
                  inputMode="decimal"
                  autoComplete="off"
                  className="rpg-input w-full"
                />
              </div>
              <div className="flex-1">
                <label htmlFor={`milestone-unit-${index}`} className="block text-xs uppercase tracking-wider text-ink-soft mb-1">
                  Unit
                </label>
                <input
                  id={`milestone-unit-${index}`}
                  value={milestone.unit}
                  onChange={(e) => editMilestone(index, { unit: e.target.value })}
                  maxLength={20}
                  autoComplete="off"
                  className="rpg-input w-full"
                />
              </div>
            </div>
          )}

          <fieldset className="mt-4">
            <legend className="text-xs uppercase tracking-wider text-ink-soft mb-1">Daily quests</legend>
            {quests.map((quest, questIndex) =>
              quest.milestone === index + 1 ? (
                <div key={questIndex} className="flex gap-2 mb-2">
                  <input
                    value={quest.title}
                    onChange={(e) =>
                      setQuests((current) =>
                        current.map((q, i) => (i === questIndex ? { ...q, title: e.target.value } : q)),
                      )
                    }
                    maxLength={150}
                    autoComplete="off"
                    aria-label={`Daily quest ${questIndex + 1} for milestone ${index + 1}`}
                    className="rpg-input flex-1"
                  />
                  <select
                    value={quest.attribute}
                    onChange={(e) =>
                      setQuests((current) =>
                        current.map((q, i) => (i === questIndex ? { ...q, attribute: e.target.value } : q)),
                      )
                    }
                    aria-label={`What daily quest ${questIndex + 1} raises`}
                    className="rpg-select"
                  >
                    {ATTRIBUTES.map((attribute) => (
                      <option key={attribute} value={attribute}>
                        {attribute[0].toUpperCase() + attribute.slice(1)}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setQuests((current) => current.filter((_, i) => i !== questIndex))}
                    className="rpg-btn-secondary"
                    aria-label={`Remove quest ${questIndex + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : null,
            )}
            {questsFor(index + 1) < MAX_QUESTS_PER_MILESTONE && (
              <button
                onClick={() =>
                  setQuests((current) => [
                    ...current,
                    { title: '', attribute: 'discipline', milestone: index + 1 },
                  ])
                }
                className="rpg-btn-secondary"
              >
                Add a daily quest
              </button>
            )}
          </fieldset>
        </div>
      ))}

      {milestones.length < MAX_MILESTONES && (
        <button
          onClick={() => setMilestones((current) => [...current, blankMilestone()])}
          className="rpg-btn-secondary w-full flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Add a milestone
        </button>
      )}

      {error && (
        <p className="rpg-window-light px-4 py-3 text-sm" style={{ color: 'var(--accent-rust)' }} role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} disabled={saving} className="rpg-btn-secondary flex-1">
            Cancel
          </button>
        )}
        {/* Disabled while it saves: the client retries a lost response, and a
            second confirm would replace the path it just created. */}
        <button onClick={confirmPath} disabled={saving} className="rpg-btn-gold flex-1">
          {saving ? 'Setting your path…' : 'Confirm this path'}
        </button>
      </div>
    </div>
  );
}

import { Status } from '@augur/app-kit';
import type { AppJob } from './api.js';
import { STEP_WORDS } from './installs.js';
import { Line } from './parts.js';

/** A job's steps as the runner reported them. */
export const JobSteps = ({ job }: { job: AppJob }) => (
  <div data-job-steps>
    {job.steps.map((s, i) => (
      <Line key={i} end={new Date(s.at).toLocaleTimeString()}>
        <Status status={s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : 'running'} markOnly /> {STEP_WORDS[s.step]}
        {s.message ? `: ${s.message}` : ''}
      </Line>
    ))}
  </div>
);

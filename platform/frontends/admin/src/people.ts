import type { RemoteNode } from '@augur/mfe-sdk/sdk3';
import { departmentPath, fullName, type Department, type Person } from './api.js';
import { asking, off, said, shownOnce, waiting } from './common.js';
import { day, lastSignIn, lifecycleFacts, statusOf } from './parts.js';
import { quill } from './quill.js';
import { pathOf } from './routes.js';
import type { View } from './view.js';

const NO_DEPARTMENT = '';
/** The leaver flow's choice when nobody takes on their work: apps keep it until someone does. */
const NO_ONE = '';
/** The role that deletes a leaver's account now, after entering the password again (ADR 0072). */
export const DEPLOYMENT_ADMIN = 'deployment-admin';
const EMAIL_OFF = 'Email isn’t set up on this deployment. Whoever runs the server adds it to .env.';

export const emailProblem = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : 'That email is missing something, like @example.org');

const departmentOptions = (departments: Department[]) => [
  { value: NO_DEPARTMENT, label: 'No department' },
  ...departments
    .map((d) => ({ value: d.id, label: departmentPath(d.id, departments), detail: `${d.members.length} ${d.members.length === 1 ? 'person' : 'people'}` }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

const nameOf = (people: Person[]) => (id: string) => {
  const p = people.find((x) => x.id === id);
  return p ? fullName(p) : 'someone else';
};

/** Everyone who can sign in, their department and roles, and where their sign-in stands. Each opens their own page. */
export const peoplePage = (v: View, adding = false): RemoteNode => {
  const { people, departments, leaving } = v.r;
  const wait = waiting([people, departments], 'Reading who can sign in');
  if (wait) return wait;
  const asked = new Set((leaving.value ?? []).map((r) => r.person));
  const rows = people
    .value!.map((p) => {
      const leavingAsked = p.enabled && asked.has(p.id);
      return {
        id: p.id,
        name: fullName(p),
        email: p.email ?? '',
        department: p.departments.map((d) => departmentPath(d, departments.value!)).join(', '),
        roles: p.roles.join(', '),
        signIn: leavingAsked ? 'Asked to leave' : statusOf(p).label,
        lastSignIn: lastSignIn(p),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    quill(
      'quill-table',
      {
        label: 'People',
        noun: 'people',
        filterable: true,
        pageSize: 25,
        columns: [
          { key: 'name', label: 'Name', sortable: true },
          { key: 'email', label: 'Email', sortable: true },
          { key: 'department', label: 'Department', sortable: true },
          { key: 'roles', label: 'Roles' },
          { key: 'signIn', label: 'Sign-in', sortable: true },
          { key: 'lastSignIn', label: 'Last sign-in' },
        ],
        rows,
        empty: 'No one here yet.',
        onOpen: (id: string) => v.on.go(pathOf({ page: 'person', id })),
      },
      [quill('quill-button', { slot: 'actions', label: 'Add a person', kind: 'secondary', size: 'sm', onPress: () => v.on.go(pathOf({ page: 'person-new' })) })],
    ),
    said(v, 'people'),
    adding ? addQuestion(v) : null,
    shownOnce(v),
  ];
};

/** Adding someone: they get an invite email, or a one-time password the admin gives them. */
const addQuestion = (v: View): RemoteNode => {
  const canEmail = v.r.lifecycle.value?.email ?? false;
  const roles = v.r.roles.value ?? [];
  return quill(
    'quill-dialog',
    {
      ...asking(v, pathOf({ page: 'people' })),
      size: 'glance',
      eyebrow: 'People',
      heading: 'Add a person',
      summary: 'They get an invite email, or a one-time password you give them. Either way they choose their own password.',
      actionLabel: 'Add',
      busyLabel: 'Adding',
      onSubmit: (values: Record<string, string>) => {
        const email = values.email ?? '';
        if (emailProblem(email)) {
          v.ui.dialog = { error: emailProblem(email) };
          return v.on.draw();
        }
        const start = values.start === 'email' || values.start === 'temporary-password' ? values.start : canEmail ? 'email' : 'temporary-password';
        let to = pathOf({ page: 'people' });
        v.on.answer(
          () => to,
          async () => {
            const { person, invite, temporaryPassword } = await v.api.addPerson({
              start,
              firstName: (values.firstName ?? '').trim(),
              lastName: (values.lastName ?? '').trim(),
              email: email.trim(),
              ...(values.username?.trim() ? { username: values.username.trim().toLowerCase() } : {}),
              roles: v.ui.draft.roles ?? [],
              departments: values.department ? [values.department] : [],
            });
            v.on.put('people', [...(v.r.people.value ?? []), person]);
            v.on.again('departments');
            to = pathOf({ page: 'person', id: person.id });
            if (temporaryPassword) v.ui.shown = { heading: `Give ${fullName(person)} this password`, summary: 'It works once. They choose their own when they sign in with it.', label: 'One-time password', value: temporaryPassword };
            else if (invite?.error) v.ui.done = { where: 'sign-in', words: `${fullName(person)} was added, but the invite email couldn’t be sent: ${invite.error} Send it again below, or give them a one-time password.` };
            else if (invite?.method === 'email') v.ui.done = { where: 'sign-in', words: `Invite sent to ${invite.sentTo ?? person.email ?? fullName(person)}. The link works until ${invite.expiresAt ? day(invite.expiresAt) : 'it runs out'}.` };
          },
        );
      },
    },
    [
      quill('quill-text-field', { slot: 'fields', name: 'firstName', label: 'First name', required: true }),
      quill('quill-text-field', { slot: 'fields', name: 'lastName', label: 'Last name', required: true }),
      quill('quill-text-field', { slot: 'fields', name: 'email', type: 'email', label: 'Email', required: true }),
      quill('quill-text-field', { slot: 'fields', name: 'username', label: 'Username', optional: true, hint: 'What they sign in with. Leave it empty to use the part of their email before the @.' }),
      quill('quill-select', {
        slot: 'fields',
        name: 'start',
        label: 'How they start',
        options: [
          { value: 'email', label: 'Email them an invite', detail: canEmail ? 'A link that lasts 72 hours to choose a password' : EMAIL_OFF, disabled: !canEmail },
          { value: 'temporary-password', label: 'Give them a one-time password', detail: 'Read it to them; they choose their own at first sign-in' },
        ],
        value: canEmail ? 'email' : 'temporary-password',
      }),
      quill('quill-select', { slot: 'fields', name: 'department', label: 'Department', options: departmentOptions(v.r.departments.value ?? []), value: NO_DEPARTMENT }),
      quill('quill-checkbox-group', {
        slot: 'fields',
        label: 'Roles',
        optional: true,
        options: roles.map((r) => ({ value: r.name, label: r.name, ...(r.description ? { detail: r.description } : {}) })),
        value: v.ui.draft.roles ?? [],
        onChange: (chosen: string[]) => void (v.ui.draft.roles = chosen),
      }),
    ],
  );
};

/** What the page says about their leaving, above its choices. */
const leavingWords = (v: View, p: Person, name: (id: string) => string) => {
  const asked = v.r.leaving.value?.find((r) => r.person === p.id);
  if (p.state === 'left') return `They left on ${day(p.left!.at)}${p.left!.handOverTo ? `, handing their work to ${name(p.left!.handOverTo)}` : ''}.`;
  if (p.leaving) return `They leave after ${day(`${p.leaving.on}T12:00:00`)}. Until then nothing changes for them; change the day or cancel it here.`;
  if (asked) return `They asked to leave on ${day(asked.requestedAt)}${asked.note ? `: “${asked.note}”` : '.'}`;
  return 'For someone leaving the organisation. Their sign-in goes off, they’re signed out everywhere, and apps hand on what they own. Their teams and history stay.';
};

/**
 * One person, on a page of their own. Their name, email, department and roles save as each changes; their
 * sign-in and the leaver flow (ADR 0040) act at once, each saying what it did where it was pressed.
 */
export const personPage = (v: View, id: string, ask?: 'delete'): RemoteNode => {
  const { people, departments, roles } = v.r;
  const wait = waiting([people, departments], 'Reading who can sign in');
  if (wait) return wait;
  const p = people.value!.find((x) => x.id === id);
  if (!p) return quill('quill-state', { kind: 'empty', heading: 'Nobody here has that id', body: 'They may have been deleted.', action: 'See everyone', size: 'page', onAction: () => v.on.go(pathOf({ page: 'people' })) });
  const all = people.value!;
  const name = nameOf(all);
  const save = (changes: Parameters<View['api']['updatePerson']>[1]) =>
    v.on.act('details', async () => {
      const updated = await v.api.updatePerson(p.id, changes);
      v.on.put('people', all.map((x) => (x.id === p.id ? updated : x)));
      // Membership counts changed somewhere; read them again rather than guess.
      if (changes.departments) v.on.again('departments');
    });
  const replace = (next: Person) => v.on.put('people', (v.r.people.value ?? []).map((x) => (x.id === next.id ? next : x)));
  const left = p.state === 'left';
  const canEmail = v.r.lifecycle.value?.email ?? false;
  const info = v.r.lifecycle.value ?? { email: false };
  const heir = v.ui.draft.heir ?? p.leaving?.handOverTo ?? NO_ONE;
  const lastDay = v.ui.draft.lastDay ?? '';
  const past = Boolean(lastDay && info.today && lastDay < info.today);
  const heirs = [
    { value: NO_ONE, label: 'No one yet', detail: 'Apps keep what they own until someone takes it on' },
    ...all
      .filter((x) => x.id !== p.id && (x.enabled || x.id === p.leaving?.handOverTo))
      .map((x) => ({ value: x.id, label: fullName(x), ...(x.email ? { detail: x.email } : {}) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];
  const [first, ...others] = p.departments;
  const signIn = (words: string, change: () => Promise<void>) =>
    v.on.act('sign-in', async () => {
      await change();
      v.ui.done = { where: 'sign-in', words };
    });

  return [
    quill('quill-details', { items: lifecycleFacts(p, name), limit: 0 }),
    quill('quill-section', { label: 'Their details' }, [
      quill('quill-text-field', { label: 'First name', value: p.firstName, required: true, onCommit: (x: string) => x.trim() && x.trim() !== p.firstName && save({ firstName: x.trim() }) }),
      quill('quill-text-field', { label: 'Last name', value: p.lastName, required: true, onCommit: (x: string) => x.trim() !== p.lastName && save({ lastName: x.trim() }) }),
      quill('quill-text-field', {
        label: 'Email',
        type: 'email',
        value: p.email ?? '',
        required: true,
        onCommit: (x: string) => {
          if (x.trim() === (p.email ?? '')) return;
          if (emailProblem(x)) {
            v.ui.problem = { where: 'details', words: emailProblem(x)! };
            return v.on.draw();
          }
          save({ email: x.trim() });
        },
      }),
      quill('quill-select', {
        label: 'Department',
        options: departmentOptions(departments.value!),
        value: first ?? NO_DEPARTMENT,
        hint: others.length ? `Also in ${others.map((d) => departmentPath(d, departments.value!)).join(', ')}, from Departments.` : undefined,
        // The select holds the first department; any others are left as they are.
        onChange: (d: string) => save({ departments: d ? [d, ...others.filter((x) => x !== d)] : others }),
      }),
      quill('quill-checkbox-group', {
        label: 'Roles',
        optional: true,
        options: (roles.value ?? []).map((r) => ({ value: r.name, label: r.name, ...(r.description ? { detail: r.description } : {}) })),
        value: p.roles,
        ...off(roles.error ? `The roles couldn’t be read: ${roles.error}` : !roles.value && 'Reading the roles.'),
        onChange: (chosen: string[]) => save({ roles: chosen }),
      }),
      said(v, 'details'),
    ]),
    quill('quill-section', { label: 'Their sign-in' }, [
      quill('quill-notice', { tone: 'info' }, p.enabled ? 'They can sign in. These act at once.' : 'Their sign-in is off: they can’t sign in. Nothing of theirs is removed.'),
      p.enabled
        ? quill('quill-ask-twice', {
            label: 'Turn off their sign-in',
            confirm: 'Press again: they can’t sign in from now',
            size: 'sm',
            ...off(p.id === v.me && 'You can’t turn off your own sign-in.'),
            onPress: () => signIn('Sign-in turned off: they’re signed out everywhere and can’t sign in until it’s turned on again.', async () => replace(await v.api.updatePerson(p.id, { enabled: false }))),
          })
        : quill('quill-button', {
            label: 'Turn their sign-in on',
            kind: 'secondary',
            size: 'sm',
            ...off(left && 'They’ve left, and a leaver doesn’t come back. Add them again if they return.'),
            onPress: () => signIn('Sign-in turned on: they can sign in again.', async () => replace(await v.api.updatePerson(p.id, { enabled: true }))),
          }),
      p.state === 'invited'
        ? quill('quill-button', {
            label: 'Send a new invite',
            kind: 'secondary',
            size: 'sm',
            ...off(!canEmail && EMAIL_OFF),
            onPress: () =>
              v.on.act('sign-in', async () => {
                const { invite } = await v.api.resendInvite(p.id);
                replace({ ...p, invite: { method: 'email', sentAt: new Date().toISOString(), ...(invite.expiresAt ? { expiresAt: invite.expiresAt } : {}), expired: false, count: (p.invite?.count ?? 0) + 1 } });
                v.ui.done = { where: 'sign-in', words: `New invite sent to ${invite.sentTo ?? p.email ?? fullName(p)}. The old link no longer works.` };
              }),
          })
        : null,
      quill('quill-button', {
        label: 'Unlock',
        kind: 'secondary',
        size: 'sm',
        ...off(!(p.lockout?.locked ?? p.locked) && 'They aren’t locked out.'),
        onPress: () => signIn('Unlocked: they can sign in again now.', async () => (await v.api.unlock(p.id), replace({ ...p, locked: false, ...(p.lockout ? { lockout: { ...p.lockout, locked: false } } : {}) }))),
      }),
      quill('quill-ask-twice', {
        label: 'Give them a new one-time password',
        confirm: 'Press again: their current password stops working',
        size: 'sm',
        onPress: () =>
          signIn('New one-time password given: their old password no longer works.', async () => {
            const { temporaryPassword } = await v.api.resetPassword(p.id);
            replace({ ...p, invited: true });
            v.ui.shown = { heading: `Give ${fullName(p)} this password`, summary: 'It works once. They choose their own when they sign in with it.', label: 'One-time password', value: temporaryPassword };
          }),
      }),
      said(v, 'sign-in'),
    ]),
    quill('quill-section', { label: 'Leaving' }, [
      quill('quill-notice', { tone: 'info' }, leavingWords(v, p, name)),
      left
        ? null
        : [
            quill('quill-select', { label: 'Hand their work to', optional: true, options: heirs, value: heir, onChange: (x: string) => ((v.ui.draft.heir = x), v.on.draw()) }),
            quill('quill-text-field', { label: 'Note for Activity', optional: true, multiline: true, rows: 2, maxLength: 500, value: v.ui.draft.note ?? '', hint: 'Why, or what was agreed. Shown in Activity.', onChange: (x: string) => void (v.ui.draft.note = x) }),
            quill('quill-date-field', {
              label: 'Last day',
              optional: true,
              value: lastDay,
              empty: 'Leave now',
              ...off(!info.today && 'A last day can’t be set while identity can’t read the organisation’s time zone. Run it now, or try again later.'),
              hint: info.today ? `Leave it empty to run the leaver flow now. With a day, it runs once that day is over, up to ${info.lastDayAhead ?? 90} days ahead.` : undefined,
              ...(past ? { state: 'error' as const, message: 'That day is past. Leave it empty to run it now.' } : {}),
              onChange: (x: string) => ((v.ui.draft.lastDay = x), v.on.draw()),
            }),
            quill('quill-ask-twice', {
              label: lastDay ? (p.leaving ? 'Move their last day' : 'Set their last day') : 'They’re leaving',
              confirm: lastDay ? `Press again: they leave after ${day(`${lastDay}T12:00:00`)}` : 'Press again: they leave now',
              size: 'sm',
              ...off((p.id === v.me && 'You can’t run the leaver flow on yourself. Ask another admin.') || (past && 'That day is past. Leave it empty to run it now.')),
              onPress: () =>
                v.on.act('leaving', async () => {
                  const to = all.find((x) => x.id === heir);
                  const note = v.ui.draft.note?.trim();
                  replace(await v.api.leave(p.id, { ...(to ? { handOverTo: to.id } : {}), ...(note ? { note } : {}), ...(lastDay ? { lastDay } : {}) }));
                  v.ui.draft = {};
                  if (lastDay) {
                    v.ui.done = { where: 'leaving', words: `They leave after ${day(`${lastDay}T12:00:00`)}: until then nothing changes for them. You can cancel it here.` };
                    return;
                  }
                  v.on.again('leaving');
                  v.ui.done = {
                    where: 'leaving',
                    words: to ? `They’ve left: signed out everywhere, and apps are handing what they own to ${fullName(to)}.` : 'They’ve left: signed out everywhere. Apps keep what they own until someone takes it on.',
                  };
                }),
            }),
          ],
      p.leaving
        ? quill('quill-button', {
            label: 'Cancel leaving',
            kind: 'secondary',
            size: 'sm',
            onPress: () =>
              v.on.act('leaving', async () => {
                replace(await v.api.cancelLeave(p.id));
                v.ui.done = { where: 'leaving', words: 'They’re no longer leaving. Nothing had changed for them yet.' };
              }),
          })
        : null,
      left
        ? quill('quill-button', {
            label: 'Delete their account now',
            kind: 'danger',
            size: 'sm',
            ...off((p.deleting && 'Deleting their account has started; it carries on by itself.') || (!v.deploymentAdmin && `Only a deployment admin can do this. Ask someone who holds the ${DEPLOYMENT_ADMIN} role.`)),
            onPress: () => v.on.go(pathOf({ page: 'person', id: p.id, ask: 'delete' })),
          })
        : null,
      said(v, 'leaving'),
    ]),
    ask === 'delete' && left ? deleteQuestion(v, p) : null,
    shownOnce(v),
  ];
};

/** Deleting a leaver's account now, at a path of its own: the password is entered again first, and comes back here. */
const deleteQuestion = (v: View, p: Person): RemoteNode =>
  quill('quill-dialog', {
    ...asking(v, pathOf({ page: 'person', id: p.id })),
    size: 'glance',
    danger: true,
    heading: `Delete ${fullName(p)}’s account now?`,
    summary: 'It goes for good, before the organisation’s retention period is up, and Activity keeps only an anonymous id for them. You may be asked for your password first.',
    actionLabel: 'Delete their account',
    busyLabel: 'Deleting',
    cancelLabel: 'Keep it',
    onSubmit: () =>
      v.on.answer(pathOf({ page: 'people' }), async () => {
        await v.api.deletePerson(p.id);
        v.on.put('people', (v.r.people.value ?? []).filter((x) => x.id !== p.id));
        v.ui.done = { where: 'people', words: `${fullName(p)}’s account was deleted.` };
      }),
  });

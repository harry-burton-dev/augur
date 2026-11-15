import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Contained, stoppedWords } from './contained.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLElement;
let root: Root;
let broken = true;
const Breaks = () => {
  if (broken) throw new Error('cannot read name of undefined');
  return <p>Working again</p>;
};

beforeEach(() => {
  broken = true;
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

describe('Contained', () => {
  it('stops only the part that threw, says who can fix it, and tries again', () => {
    const stopped = vi.fn();
    act(() =>
      root.render(
        <>
          <p>The rail</p>
          <Contained part="The Inbox" onStopped={stopped}>
            <Breaks />
          </Contained>
        </>,
      ),
    );
    expect(host.textContent).toContain('The rail');
    const alert = host.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('The Inbox stopped');
    expect(alert.textContent).toMatch(/fault in AUGUR/);
    expect(alert.textContent).toMatch(/admin of AUGUR here/);
    expect(stopped).toHaveBeenCalledWith(expect.objectContaining({ message: 'cannot read name of undefined' }));
    broken = false;
    act(() => (alert.querySelector('button') as HTMLButtonElement).click());
    expect(host.textContent).toContain('Working again');
    expect(host.querySelector('[role="alert"]')).toBeNull();
  });

  it('starts again by itself when what it holds changes, such as another floor', () => {
    let move: (n: number) => void = () => {};
    const Moves = () => {
      const [floor, setFloor] = useState(1);
      move = setFloor;
      return (
        <Contained part="The Account area" resetOn={floor} onStopped={() => {}}>
          <Breaks />
        </Contained>
      );
    };
    act(() => root.render(<Moves />));
    expect(host.textContent).toContain('The Account area stopped');
    broken = false;
    act(() => move(2));
    expect(host.textContent).toContain('Working again');
  });

  it('keeps a working part as it is when resetOn changes', () => {
    broken = false;
    let mounts = 0;
    const Counts = () => {
      useState(() => mounts++);
      return <p>Fine</p>;
    };
    let move: (n: number) => void = () => {};
    const Moves = () => {
      const [section, setSection] = useState(1);
      move = setSection;
      return (
        <Contained part="The Account area" resetOn={section}>
          <Counts />
        </Contained>
      );
    };
    act(() => root.render(<Moves />));
    act(() => move(2));
    expect(mounts).toBe(1);
  });

  it('names the deployment’s own product', () => {
    expect(stoppedWords('The Inbox', { rest: true, product: 'Skein' }).body).toMatch(/fault in Skein.*admin of Skein here/);
  });

  it('offers a reload in place of trying again, for the whole screen', () => {
    const reload = vi.fn(() => {
      broken = false;
    });
    act(() =>
      root.render(
        <Contained part="Everything" page again={{ label: 'Reload', onPress: reload }} onStopped={() => {}}>
          <Breaks />
        </Contained>,
      ),
    );
    const button = host.querySelector('[role="alert"] button') as HTMLButtonElement;
    expect(button.textContent).toBe('Reload');
    act(() => button.click());
    expect(reload).toHaveBeenCalledOnce();
    expect(host.textContent).not.toMatch(/still works/);
  });
});

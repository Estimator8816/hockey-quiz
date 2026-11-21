import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { createLocalStore } from '../../src/storage/store';
import { App } from '../../src/app';
import { clearDeviceRole, setDeviceRole } from '../../src/storage/deviceRole';
import { parseInvite } from '../../src/ui/install';
import { content, memStorage } from './fixtures';

const standalone = vi.hoisted(() => ({ on: false }));
vi.mock('../../src/ui/install', async (orig) => ({ ...(await orig<object>()), isStandalone: () => standalone.on }));

afterEach(() => { cleanup(); clearDeviceRole(); standalone.on = false; });
const mountApp = (hash: string) => { location.hash = hash; render(<App store={createLocalStore(memStorage())} client={null} content={content} />); };

describe('установка на iPhone', () => {
  it('parseInvite', () => {
    expect(parseInvite('https://x.io/hockey-quiz/#/parent/join/JepTL9Du5b9S')).toEqual({ kind: 'parent', code: 'JepTL9Du5b9S' });
    expect(parseInvite(' https://x.io/hockey-quiz/#/join/HKZUHMTyRm ')).toEqual({ kind: 'child', code: 'HKZUHMTyRm' });
    expect(parseInvite('HKZUHMTyRm')).toEqual({ kind: 'child', code: 'HKZUHMTyRm' });
    expect(parseInvite('привет')).toBeNull();
  });
  it('iconWithoutCodeAsksForLinkNotGame', () => {
    standalone.on = true;
    mountApp('#/');
    expect(screen.getByText('Вставить ссылку')).toBeTruthy();
    expect(document.querySelector('a.card-start')).toBeNull();
  });
  it('pastedParentLinkGoesToParentJoin', async () => {
    standalone.on = true;
    mountApp('#/');
    fireEvent.input(screen.getByLabelText(/Или вставьте сюда/), { target: { value: 'https://x.io/hockey-quiz/#/parent/join/JepTL9Du5b9S' } });
    fireEvent.click(screen.getByText('Подключиться'));
    await waitFor(() => expect(location.hash).toBe('#/parent/join/JepTL9Du5b9S'));
  });
  it('connectedIconGoesStraightToGame', () => {
    standalone.on = true;
    setDeviceRole('child');
    mountApp('#/');
    expect(document.querySelector('a.card-start')).toBeTruthy();
  });
});

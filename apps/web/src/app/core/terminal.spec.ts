import { CONTENT_FIXTURE } from '../../testing/content.fixture';
import {
  TERMINAL_COMMANDS,
  type TerminalContext,
  type TerminalLine,
  completeCommand,
  looksLikeShell,
  normalizeCommand,
  parseCommand,
  runCommand,
  shortHash,
  suggestCommands,
} from './terminal';

const t = (key: string, params?: Record<string, unknown>) =>
  params ? `${key}${JSON.stringify(params)}` : key;
const context = (over: Partial<TerminalContext> = {}): TerminalContext => ({
  content: CONTENT_FIXTURE,
  locale: 'en',
  t,
  now: new Date('2026-11-05T00:00:00Z'),
  ...over,
});
const plain = (lines: TerminalLine[]) => lines.map((line) => line.map((s) => s.text).join(''));

describe('terminal parsing', () => {
  it('normalizes case and spaces', () => {
    expect(normalizeCommand('  Git   LOG ')).toBe('git log');
  });

  it('recognizes listed commands, aliases, easter eggs and sudo hire with any name', () => {
    expect(parseCommand('whoami')).toBe('whoami');
    expect(parseCommand('git log')).toBe('git log --oneline');
    expect(parseCommand('ls')).toBe('ls projects/');
    expect(parseCommand(':q')).toBe('exit');
    expect(parseCommand('coffee')).toBe('coffee');
    expect(parseCommand('sudo hire somebody')).toBe('sudo hire');
    expect(parseCommand('angular')).toBeNull();
    expect(parseCommand('')).toBeNull();
  });

  it('tells shell input from a search', () => {
    expect(looksLikeShell('help')).toBe(true);
    expect(looksLikeShell('git status')).toBe(true);
    expect(looksLikeShell('skills')).toBe(false);
    expect(looksLikeShell('  ')).toBe(false);
  });

  it('suggests listed commands only, never the hidden ones', () => {
    expect(suggestCommands('wh')).toEqual(['whoami']);
    expect(suggestCommands('c')).toEqual([]);
    expect(suggestCommands('cl')).toEqual(['clear']);
    expect(suggestCommands('cof')).toEqual([]);
  });

  it('completes a unique prefix and leaves ambiguous input alone', () => {
    expect(completeCommand('git')).toBe('git log --oneline');
    expect(completeCommand('c')).toBe('c');
    expect(completeCommand('')).toBe('');
  });

  it('builds short stable hashes', () => {
    expect(shortHash('a')).toMatch(/^[0-9a-f]{7}$/);
    expect(shortHash('a')).toBe(shortHash('a'));
    expect(shortHash('a')).not.toBe(shortHash('b'));
  });
});

describe('terminal output', () => {
  it('lists every command in help', () => {
    const out = plain(runCommand('help', context()).lines);
    for (const name of TERMINAL_COMMANDS) expect(out.some((l) => l.startsWith(name))).toBe(true);
  });

  it('answers whoami from the profile', () => {
    const out = plain(runCommand('whoami', context()).lines);
    expect(out[0]).toBe(CONTENT_FIXTURE.profile!.fullName);
  });

  it('prints the career as commits, newest first, from the experience', () => {
    const out = plain(runCommand('git log', context()).lines);
    expect(out[0]).toContain('2021-01 feat(example-corp)');
    expect(out[1]).toContain('2018-03 feat(sample-ltd)');
    expect(out.at(-1)).toContain('chore: init');
  });

  it('lists only level 5 skills in the stack', () => {
    const out = plain(runCommand('cat stack.txt', context()).lines).join('\n');
    expect(out).toContain('Angular');
    expect(out).not.toContain('CSS');
  });

  it('computes uptime from the first role', () => {
    const out = plain(runCommand('uptime', context()).lines)[0];
    expect(out).toMatch(/^up 8y 8m · 2 hero\.missions/);
  });

  it('lists projects by slug', () => {
    const out = plain(runCommand('ls projects/', context()).lines);
    expect(out[0]).toMatch(/^example\//);
  });

  it('says so when nothing is published', () => {
    const empty = {
      ...CONTENT_FIXTURE,
      profile: null,
      experiences: [],
      skills: [],
      projects: [],
      education: [],
    };
    for (const command of ['whoami', 'git log', 'cat stack.txt', 'uptime', 'ls']) {
      expect(plain(runCommand(command, context({ content: empty })).lines)).toEqual([
        'terminal.empty',
      ]);
    }
  });

  it('returns the follow-up actions', () => {
    expect(runCommand('sudo hire me', context()).action).toBe('contact');
    expect(runCommand('clear', context()).action).toBe('clear');
    expect(runCommand('exit', context()).action).toBe('exit');
  });

  it('answers easter eggs and unknown commands', () => {
    expect(plain(runCommand('vim', context()).lines)).toEqual(['terminal.eggs.vim']);
    expect(plain(runCommand('git push', context()).lines)[0]).toContain('terminal.notFound');
  });
});

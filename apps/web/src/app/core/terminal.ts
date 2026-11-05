import type { ContentSnapshot, Locale } from '@asa/shared';
import { resolveLocalized } from '@asa/shared';

/**
 * The hidden terminal of the command palette (ADR 23). Typing a developer command such as `help`,
 * `whoami` or `git log` switches the palette to a console whose answers are computed from the
 * published content, never typed in. Pure functions only: the palette renders the lines and runs
 * the follow-up action.
 */

export type TerminalTone = 'ok' | 'muted' | 'accent' | 'hash';

export interface TerminalSegment {
  text: string;
  tone?: TerminalTone;
}

export type TerminalLine = readonly TerminalSegment[];

/** What the palette does once the output is shown. */
export type TerminalAction = 'clear' | 'exit' | 'contact';

export interface TerminalResult {
  lines: TerminalLine[];
  action?: TerminalAction;
}

export interface TerminalContext {
  content: ContentSnapshot | null;
  locale: Locale;
  /** Transloco lookup for the current language. */
  t: (key: string, params?: Record<string, unknown>) => string;
  now?: Date;
}

/** Commands listed by `help` and offered in the palette, in this order. */
export const TERMINAL_COMMANDS = [
  'help',
  'whoami',
  'cat stack.txt',
  'git log --oneline',
  'uptime',
  'ls projects/',
  'sudo hire',
  'clear',
  'exit',
] as const;

export type TerminalCommand = (typeof TERMINAL_COMMANDS)[number];

/** Easter eggs: answered, but never listed or suggested. */
const HIDDEN = ['rm -rf /', 'coffee', 'vim', 'ng serve'] as const;
type HiddenCommand = (typeof HIDDEN)[number];

const ALIASES: Record<string, TerminalCommand | HiddenCommand> = {
  'cat stack': 'cat stack.txt',
  'git log': 'git log --oneline',
  ls: 'ls projects/',
  'ls projects': 'ls projects/',
  'rm -rf': 'rm -rf /',
  ':q': 'exit',
  quit: 'exit',
  emacs: 'vim',
  nano: 'vim',
};

/** Words that only make sense as shell input; typing one opens the terminal. */
const SHELL_WORDS = /^(sudo|git|cat|ls|rm|cd|ng|npm|pnpm|echo|man)\b/;

/** Folds case and runs of spaces: `  Git   LOG ` → `git log`. */
export function normalizeCommand(input: string): string {
  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The command the input names, or null when it is not a terminal command at all. */
export function parseCommand(input: string): TerminalCommand | HiddenCommand | null {
  const text = normalizeCommand(input);
  if (!text) return null;
  if (text === 'sudo hire' || text.startsWith('sudo hire ')) return 'sudo hire';
  if ((TERMINAL_COMMANDS as readonly string[]).includes(text)) return text as TerminalCommand;
  if ((HIDDEN as readonly string[]).includes(text)) return text as HiddenCommand;
  return ALIASES[text] ?? null;
}

/** Whether the palette should treat the input as shell input rather than a search. */
export function looksLikeShell(input: string): boolean {
  const text = normalizeCommand(input);
  return !!text && (parseCommand(text) !== null || SHELL_WORDS.test(text));
}

/** Listed commands that complete the input (at least two letters, or an exact match). */
export function suggestCommands(input: string): TerminalCommand[] {
  const text = normalizeCommand(input);
  if (!text) return [];
  return TERMINAL_COMMANDS.filter(
    (command) => command === text || (text.length >= 2 && command.startsWith(text)),
  );
}

/** Tab completion: the single listed command the input starts, or the input unchanged. */
export function completeCommand(input: string): string {
  const text = normalizeCommand(input);
  const matches = TERMINAL_COMMANDS.filter((command) => command.startsWith(text));
  const [only] = matches;
  return text && only && matches.length === 1 ? only : input;
}

/** A short, stable git-like hash, so the same entry always shows the same id. */
export function shortHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').slice(0, 7);
}

function slug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'job'
  );
}

const line = (...segments: TerminalSegment[]): TerminalLine => segments;
const text = (value: string, tone?: TerminalTone): TerminalSegment =>
  tone ? { text: value, tone } : { text: value };

/** Runs a command. Unknown input answers with a hint towards `help`. */
export function runCommand(input: string, context: TerminalContext): TerminalResult {
  const command = parseCommand(input);
  const { t } = context;
  switch (command) {
    case null:
      return {
        lines: [
          line(
            text(t('terminal.notFound', { command: normalizeCommand(input) }), 'muted'),
            text(' help', 'accent'),
          ),
        ],
      };
    case 'help':
      return {
        lines: [
          ...TERMINAL_COMMANDS.map((name) =>
            line(
              text(name.padEnd(19), 'accent'),
              text(t(`terminal.help.${commandKey(name)}`), 'muted'),
            ),
          ),
          line(text(t('terminal.hiddenHint'), 'muted')),
        ],
      };
    case 'whoami':
      return { lines: whoami(context) };
    case 'cat stack.txt':
      return { lines: stack(context) };
    case 'git log --oneline':
      return { lines: gitLog(context) };
    case 'uptime':
      return { lines: uptime(context) };
    case 'ls projects/':
      return { lines: projects(context) };
    case 'sudo hire':
      return {
        lines: [
          line(text(t('terminal.hire.password'))),
          line(text(`✓ ${t('terminal.hire.granted')}`, 'ok'), text(` ${t('terminal.hire.next')}`)),
        ],
        action: 'contact',
      };
    case 'clear':
      return { lines: [], action: 'clear' };
    case 'exit':
      return { lines: [], action: 'exit' };
    case 'rm -rf /':
    case 'coffee':
    case 'vim':
    case 'ng serve':
      return { lines: [line(text(t(`terminal.eggs.${commandKey(command)}`), 'muted'))] };
  }
}

/** i18n key for a command: `git log --oneline` → `gitLog`. */
export function commandKey(command: string): string {
  return (
    {
      'cat stack.txt': 'stack',
      'git log --oneline': 'gitLog',
      'ls projects/': 'projects',
      'sudo hire': 'hire',
      'rm -rf /': 'rm',
      'ng serve': 'ngServe',
    }[command] ?? command
  );
}

function empty(context: TerminalContext): TerminalLine[] {
  return [line(text(context.t('terminal.empty'), 'muted'))];
}

function whoami({ content, locale, t }: TerminalContext): TerminalLine[] {
  const profile = content?.profile;
  if (!profile) return empty({ content, locale, t });
  const status = profile.availability.status;
  const availability = t(
    status === 'limited' ? 'hero.limited' : status === 'closed' ? 'hero.closed' : 'hero.available',
  );
  const where = profile.location ? resolveLocalized(profile.location, locale) : '';
  return [
    line(text(profile.fullName, 'ok')),
    line(text(resolveLocalized(profile.headline, locale))),
    line(text([where, availability].filter(Boolean).join(' · '), 'muted')),
  ];
}

function stack(context: TerminalContext): TerminalLine[] {
  const groups = (context.content?.skills ?? [])
    .map((group) => ({
      name: resolveLocalized(group.category, context.locale),
      items: group.items.filter((item) => item.level === 5).map((item) => item.name),
    }))
    .filter((group) => group.items.length);
  if (!groups.length) return empty(context);
  return [
    ...groups.flatMap((group) => [
      line(text(`## ${group.name}`, 'ok')),
      line(text(group.items.join(' · '))),
    ]),
    line(text(context.t('terminal.stackMore'), 'muted')),
  ];
}

function gitLog(context: TerminalContext): TerminalLine[] {
  const { content, locale } = context;
  const jobs = [...(content?.experiences ?? [])].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  const firstSchool = [...(content?.education ?? [])].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  )[0];
  if (!jobs.length && !firstSchool) return empty(context);
  const lines = jobs.map((job) =>
    line(
      text(shortHash(`${job.company}${job.startDate}`), 'hash'),
      text(` ${job.startDate.slice(0, 7)} `, 'muted'),
      text(`feat(${slug(job.company)}): ${resolveLocalized(job.role, locale)}`),
    ),
  );
  if (firstSchool) {
    lines.push(
      line(
        text(shortHash(`${firstSchool.institution}${firstSchool.startDate}`), 'hash'),
        text(` ${firstSchool.startDate.slice(0, 7)} `, 'muted'),
        text(`chore: init (${resolveLocalized(firstSchool.degree, locale)})`),
      ),
    );
  }
  return lines;
}

function uptime(context: TerminalContext): TerminalLine[] {
  const jobs = context.content?.experiences ?? [];
  if (!jobs.length) return empty(context);
  const first = new Date(Math.min(...jobs.map((job) => Date.parse(job.startDate))));
  const now = context.now ?? new Date();
  const months =
    (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + now.getUTCMonth() - first.getUTCMonth();
  return [
    line(
      text(`up ${Math.floor(months / 12)}y ${months % 12}m`, 'ok'),
      text(` · ${jobs.length} ${context.t('hero.missions')}`),
      text(` · ${new Set(jobs.flatMap((job) => job.technologies)).size} ${context.t('hero.tech')}`),
    ),
  ];
}

function projects(context: TerminalContext): TerminalLine[] {
  const items = context.content?.projects ?? [];
  if (!items.length) return empty(context);
  return items.map((project) =>
    line(
      text(`${project.slug}/`.padEnd(20), 'accent'),
      text(resolveLocalized(project.title, context.locale), 'muted'),
    ),
  );
}

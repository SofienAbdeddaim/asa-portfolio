import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AuthService } from '../auth/auth.service.js';

const USAGE = `Account recovery for the back-office admin. Run it against the production database by
putting MONGODB_URI (and the other values from .env.example) in .env first.

  pnpm --filter @asa/api admin <command> <email>

Commands:
  unlock            clear the lockout after failed sign-ins
  reset-2fa         remove the second factor (lost authenticator and recovery codes); the next
                    sign-in, with the password, enrolls a new one
  set-password      set a new password, read from NEW_ADMIN_PASSWORD (at least 12 characters)
  revoke-sessions   sign the admin out everywhere

Passwords are never printed, and never taken from the command line (it ends up in shell history).`;

type Command = 'unlock' | 'reset-2fa' | 'set-password' | 'revoke-sessions';
const COMMANDS: readonly string[] = ['unlock', 'reset-2fa', 'set-password', 'revoke-sessions'];

const DONE: Record<Command, string> = {
  unlock: 'The lockout is cleared.',
  'reset-2fa': 'Two-factor authentication is reset. The next sign-in enrolls a new authenticator.',
  'set-password': 'The password is changed and every session is signed out.',
  'revoke-sessions': 'Every session is signed out.',
};

async function main(): Promise<void> {
  const [command, email] = process.argv.slice(2);
  if (!command || !email || !COMMANDS.includes(command)) {
    console.error(USAGE);
    process.exit(command === undefined ? 0 : 1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const auth = app.get(AuthService);
    const found = await run(auth, command as Command, email);
    if (!found) {
      console.error(`No admin with the email ${email}`);
      process.exitCode = 1;
      return;
    }
    console.log(DONE[command as Command]);
  } finally {
    await app.close();
  }
}

function run(auth: AuthService, command: Command, email: string): Promise<boolean> {
  switch (command) {
    case 'unlock':
      return auth.unlock(email);
    case 'reset-2fa':
      return auth.resetTwoFactor(email);
    case 'revoke-sessions':
      return auth.revokeSessions(email);
    case 'set-password': {
      const password = process.env['NEW_ADMIN_PASSWORD'];
      if (!password) throw new Error('Set NEW_ADMIN_PASSWORD to the new password');
      return auth.setPassword(email, password);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

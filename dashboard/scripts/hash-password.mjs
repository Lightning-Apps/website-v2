// Prints DASHBOARD_PASSWORD_HASH and a fresh DASHBOARD_SESSION_SECRET for the server's .env.
// Usage: npm run hash-password -w dashboard   (asks for the password without echoing it)
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.includes(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const password = await ask('Neues Dashboard-Passwort: ');
if (password.length < 12) {
  console.error('Bitte mindestens 12 Zeichen verwenden.');
  process.exit(1);
}
const salt = randomBytes(16);
// Separators are `:` (no `$`), so Docker env files leave the value alone.
const key = scryptSync(password, salt, 64);
console.log(`\nIn die .env des Servers eintragen:\n`);
console.log(`DASHBOARD_PASSWORD_HASH=scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`);
console.log(`DASHBOARD_SESSION_SECRET=${randomBytes(32).toString('base64url')}`);

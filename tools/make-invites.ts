import { randomBytes } from 'node:crypto';

// Запуск: npx vite-node tools/make-invites.ts <github-user> <dad-pin> <mom-pin>
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function makeCode(len = 24): string {
  const out: string[] = [];
  while (out.length < len) {
    for (const b of randomBytes(len * 2)) {
      if (b < 256 - (256 % ALPHABET.length) && out.length < len) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const [user, dadPin, momPin] = process.argv.slice(2);
if (!user || !dadPin || !momPin) {
  console.error('usage: make-invites.ts <github-user> <dad-pin> <mom-pin>');
  process.exit(1);
}
const invites = [
  { role: 'child', name: 'Данила', pin: null as string | null },
  { role: 'parent', name: 'Папа', pin: dadPin },
  { role: 'parent', name: 'Мама', pin: momPin },
].map((i) => ({ ...i, code: makeCode() }));

console.log('-- Выполнить в Supabase SQL Editor. PIN хэшируется на сервере.');
for (const i of invites) {
  const hash = i.pin === null ? 'null' : `crypt(${q(i.pin)}, gen_salt('bf'))`;
  console.log(`insert into invites (code, role, name, pin_hash) values (${q(i.code)}, ${q(i.role)}, ${q(i.name)}, ${hash});`);
}
console.log('\n-- Ссылки (сохранить в docs/ссылки.md):');
for (const i of invites) console.log(`${i.name}: https://${user}.github.io/hockey-quiz/#/join/${i.code}`);

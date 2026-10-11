// Prints the HOST_PASSWORD_HASH value for a host password: `npm run host:password`.
// The password is asked for, or read from standard input when piped, and is
// never stored. src/lib/host-password.ts reads the format written here.

import { randomBytes, scryptSync } from "node:crypto";
import { text } from "node:stream/consumers";

const MIN_LENGTH = 12;
const MAX_LENGTH = 256;
// OWASP's scrypt recommendation at 32 MB of memory.
const cost = { N: 32768, r: 8, p: 3 };

/** Reads a line from the terminal without echoing it. */
function ask(label) {
  return new Promise((resolve) => {
    const { stdin, stderr } = process;
    let typed = "";
    function finish(code) {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
      stderr.write("\n");
      if (code !== undefined) process.exit(code);
      resolve(typed);
    }
    function onData(chunk) {
      for (const key of chunk) {
        if (key === "\r" || key === "\n" || key === "\u0004") return finish();
        if (key === "\u0003") return finish(130);
        if (key === "\u007f" || key === "\b") typed = [...typed].slice(0, -1).join("");
        else typed += key;
      }
    }
    stderr.write(label);
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

let password;
if (process.stdin.isTTY) {
  password = await ask("Host password: ");
  if ((await ask("Again: ")) !== password) fail("The passwords do not match.");
} else {
  password = (await text(process.stdin)).replace(/\r?\n$/, "");
}
if ([...password].length < MIN_LENGTH) fail(`Use at least ${MIN_LENGTH} characters.`);
if (password.length > MAX_LENGTH) fail(`Use at most ${MAX_LENGTH} characters.`);

const salt = randomBytes(16);
const key = scryptSync(password.normalize("NFKC"), salt, 32, {
  ...cost,
  maxmem: 256 * cost.N * cost.r,
});
console.error("Set HOST_PASSWORD_HASH to this value. It is not the password and cannot be turned back into it.");
console.log(["scrypt", cost.N, cost.r, cost.p, salt.toString("base64url"), key.toString("base64url")].join(":"));

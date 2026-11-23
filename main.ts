// tiny-stack-vm entry: a complete interpreter for make.fun's tiny stack ISA
// (see the kit's generator/subject/ISA.md). Runs every program in /input and
// writes each program's output bytes and exit code under /output.
// Node 22, standard library only. Deterministic: no clock, no network.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode table, "byte:immediate-bytes,pops,pushes" per opcode.
const SPEC = Object.fromEntries(
  ('00:0,0,0 01:1,0,1 02:4,0,1 03:0,1,0 04:0,1,2 05:0,2,2 06:0,2,3 07:0,3,3 ' +
   '10:0,2,1 11:0,2,1 12:0,2,1 13:0,2,1 14:0,2,1 15:0,2,1 16:0,2,1 17:0,1,1 ' +
   '18:0,2,1 19:0,2,1 1a:0,2,1 1b:0,1,1 1c:0,2,1 1d:0,2,1 1e:0,2,1 20:0,2,1 ' +
   '21:0,2,1 22:0,2,1 30:2,0,0 31:2,1,0 32:2,1,0 33:2,0,0 34:0,0,0 40:0,1,1 ' +
   '41:0,2,0 50:0,1,0 51:0,1,0 52:0,0,1 53:0,1,0')
    .split(' ')
    .map((s) => {
      const [k, v] = s.split(':');
      return [parseInt(k, 16), v.split(',').map(Number)];
    }),
);

const STACK_MAX = 256;
const CALLS_MAX = 64;
const MEMORY_WORDS = 256;
const STEP_LIMIT = 1_000_000;
const OUTPUT_MAX = 65_536;

// Runs one program on its input bytes. Returns { out, code }: the bytes the
// program wrote and the exit code it ended with (a trap's code when it traps).
function run(p, inp) {
  const n = p.length;
  const D = new Int32Array(STACK_MAX);
  const C = new Int32Array(CALLS_MAX);
  const M = new Int32Array(MEMORY_WORDS);
  const out = new Uint8Array(OUTPUT_MAX);
  let ol = 0;
  let ip = 0;
  let pc = 0;
  let sp = 0;
  let cp = 0;
  let steps = 0;
  const end = (code) => ({ out: out.slice(0, ol), code });

  for (;;) {
    // Step limit first, then pc, then the opcode, then its immediate.
    if (steps === STEP_LIMIT) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const b = p[pc];
    const s = SPEC[b];
    if (s === undefined) return end(5);
    const [im, po, pu] = s;
    if (pc + im >= n) return end(9);
    steps++;
    const nx = pc + 1 + im;
    if (sp < po) return end(2);
    if (sp - po + pu > STACK_MAX) return end(3);
    pc = nx;
    switch (b) {
      case 0x00: // HALT
        return end(0);
      case 0x01: // PUSH8: sign-extended byte
        D[sp++] = (p[nx - 1] << 24) >> 24;
        break;
      case 0x02: // PUSH32: little-endian signed word
        D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24);
        break;
      case 0x03: // POP
        sp--;
        break;
      case 0x04: // DUP
        D[sp] = D[sp - 1];
        sp++;
        break;
      case 0x05: { // SWAP
        const t = D[sp - 1];
        D[sp - 1] = D[sp - 2];
        D[sp - 2] = t;
        break;
      }
      case 0x06: // OVER
        D[sp] = D[sp - 2];
        sp++;
        break;
      case 0x07: { // ROT
        const a = D[sp - 3];
        D[sp - 3] = D[sp - 2];
        D[sp - 2] = D[sp - 1];
        D[sp - 1] = a;
        break;
      }
      case 0x17: // NEG (wraps: -(-2147483648) stays -2147483648)
        D[sp - 1] = -D[sp - 1] | 0;
        break;
      case 0x1b: // NOT
        D[sp - 1] = ~D[sp - 1];
        break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const y = D[sp - 1];
        const x = D[sp - 2];
        let r;
        if (b === 0x10) r = (x + y) | 0;
        else if (b === 0x11) r = (x - y) | 0;
        else if (b === 0x12) r = Math.imul(x, y);
        else if (b === 0x13) {
          // Signed division truncates toward zero; the one overflow case
          // (-2147483648 / -1) wraps back to -2147483648 instead of 2^31.
          if (y === 0) return end(4);
          r = x === -2147483648 && y === -1 ? x : (x / y) | 0;
        } else if (b === 0x14) {
          // Signed remainder takes the sign of x; x % -1 is always 0.
          if (y === 0) return end(4);
          r = y === -1 ? 0 : (x % y) | 0;
        } else if (b === 0x15) {
          // Unsigned division: read both operands as unsigned first.
          if (y === 0) return end(4);
          r = Math.floor((x >>> 0) / (y >>> 0)) | 0;
        } else if (b === 0x16) {
          if (y === 0) return end(4);
          r = ((x >>> 0) % (y >>> 0)) | 0;
        } else if (b === 0x18) r = x & y;
        else if (b === 0x19) r = x | y;
        else if (b === 0x1a) r = x ^ y;
        else if (b === 0x1c) r = x << (y & 31);
        else if (b === 0x1d) r = x >> (y & 31);
        else if (b === 0x1e) r = (x >>> (y & 31)) | 0;
        else if (b === 0x20) r = x === y ? 1 : 0;
        else if (b === 0x21) r = x < y ? 1 : 0;
        else r = (x >>> 0) < (y >>> 0) ? 1 : 0; // LTU
        sp -= 2;
        D[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: { // JMP / JZ / JNZ
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        let take = b === 0x30;
        if (!take) {
          const v = D[--sp];
          take = b === 0x31 ? v === 0 : v !== 0;
        }
        if (take) pc = nx + rel;
        break;
      }
      case 0x33: // CALL: push return address, jump to unsigned target
        if (cp === CALLS_MAX) return end(7);
        C[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34: // RET
        if (cp === 0) return end(8);
        pc = C[--cp];
        break;
      case 0x40: { // LOAD
        const addr = D[sp - 1];
        if (addr < 0 || addr >= MEMORY_WORDS) return end(6);
        D[sp - 1] = M[addr];
        break;
      }
      case 0x41: { // STORE (value, address)
        const addr = D[sp - 1];
        const v = D[sp - 2];
        if (addr < 0 || addr >= MEMORY_WORDS) return end(6);
        sp -= 2;
        M[addr] = v;
        break;
      }
      case 0x50: { // PRINT: decimal text, no newline
        const s = String(D[sp - 1]);
        if (ol + s.length > OUTPUT_MAX) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) out[ol++] = s.charCodeAt(i);
        break;
      }
      case 0x51: // PUTC: one byte
        if (ol + 1 > OUTPUT_MAX) return end(11);
        out[ol++] = D[--sp] & 255;
        break;
      case 0x52: // IN: next input byte, -1 when used up
        D[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 0x53: // EXIT: code is the low byte
        return end(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(
    new Uint8Array(readFileSync(join(I, id, 'program.bin'))),
    new Uint8Array(readFileSync(join(I, id, 'input.bin'))),
  );
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}

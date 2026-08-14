const display = document.getElementById('display');

// The copies slide in from behind the "=" and slide back out the same way.
// SLIDE_EASE_REVERSE is the exact time-mirror of `ease` (cubic-bezier(.25,.1,.25,1)),
// so the exit retraces the entrance instead of just running it backwards linearly.
const SLIDE_MS = 220;
const SLIDE_EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
const SLIDE_EASE_REVERSE = 'cubic-bezier(0.75, 0, 0.75, 0.9)';
const SLIDE_OFFSET = '-16px';
const SLIDE_FADE = '0.35';

// Ctrl-click value change: the glyph swap rolls upward.
const ROLL_MS = 160;
const ROLL_RISE = '10px';

// Square, and the same range each way, so a step across is the same size as a step up and
// the grid reads as the even squares it is. Everything that reads a point off the panel
// scales by these against the box it is drawn in, so the size lives here and nowhere else.
const GRAPH_WIDTH = 320;
const GRAPH_HEIGHT = 320;

// How long the curve takes to draw itself in, once, when the equation behind it changes.
const GRAPH_DRAW_MS = 520;

// Whether anything on the page should move at all. Read live rather than once, so turning
// the preference on part way through is obeyed without a reload.
const graphStillness = window.matchMedia('(prefers-reduced-motion: reduce)');
function graphMayMove() {
  return !graphStillness.matches;
}

let blocks = [];
let idCounter = 0;
let dragged = [];                             // the blocks being carried, in the order they read
let carrying = false;                         // ...as a term, which is what shift picks up
let carriedAs = 'sign';                       // and what it has to become to cross the "="
let halfCarry = null;                         // the divisor being carried out from under a bar
let startedOn = null;                         // the side of the "=" it was lifted from
let startedAt = -1;                           // and where in the display it stood
let enteringIds = new Set();
let exitingIds = new Set();

/* Shift and ctrl are the whole vocabulary of this machine: shift picks up a term, ctrl points
   the keypad at a slot and does the seven other things listed on the card. A phone has
   neither key, so the mode bar above the display sets these flags instead, and every reading
   of a modifier goes through the two functions below.
   The flags are OR'd onto the real keys rather than replacing them — a keyboard still works
   the way it did, and nothing downstream has to know which one it was. */
const touchMods = { shift: false, ctrl: false };
const onPhone = !!(window.IM && window.IM.isMobile);

const shiftOn = e => e.shiftKey || touchMods.shift;
const ctrlOn = e => e.ctrlKey || e.metaKey || touchMods.ctrl;

function isSign(block) {
  return block !== undefined && block.hintOf === null
    && (coreOf(block) === '+' || coreOf(block) === MINUS);
}

// The term a block belongs to, which is what shift lights and what shift carries. A + or −
// and what it signs read as one thing; so does a bracket and everything inside it, however
// many blocks that is — a fraction whose numerator is a group is written across all of them.
function termOf(block) {
  const at = blocks.indexOf(block);
  if (at === -1) return [];
  let start = at;
  let end = at;

  if (isSign(block)) {
    const next = blocks[at + 1];
    if (next === undefined || isSign(next)) return [block];
    end = at + 1;
  }

  ({ start, end } = numberAround(start, end));
  ({ start, end } = groupAround(start, end));
  if (isSign(blocks[start - 1])) start--;
  return blocks.slice(start, end + 1);
}

// Digits spell one number out across several blocks, and what they spell is the one thing
// there is to take hold of: 1 then 2 is twelve, not one and two, so a run grows across
// them before anything else is worked out about it.
function numberAround(start, end) {
  while (start > 0 && continuesNumber(blocks[start], blocks[start - 1])) start--;
  while (end + 1 < blocks.length && continuesNumber(blocks[end + 1], blocks[end])) end++;
  return { start, end };
}

// Grows a run until no bracket it touches is left half-written: out to the far end of a pair
// it holds one side of, then out of every pair holding it, as far as the outermost. Taking
// hold of one number inside a group takes the group, because that is the term of the
// equation — what a group multiplies or divides comes away with it or the value changes.
// Neither end reaches past the "=", which is not part of any term on either side of it.
function groupAround(start, end) {
  if (coreOf(blocks[start]) === ')') {
    const open = matchingOpen(blocks, start);
    if (open !== -1) start = open;
  }
  if (coreOf(blocks[end]) === '(') {
    const close = matchingClose(blocks, end);
    if (close !== -1) end = close;
  }
  let depth = 0;
  for (let i = start - 1; i >= 0; i--) {
    const core = coreOf(blocks[i]);
    if (blocks[i].value === '=') break;
    if (core === ')') depth++;
    else if (core === '(') { if (depth === 0) start = i; else depth--; }
  }
  depth = 0;
  for (let i = end + 1; i < blocks.length; i++) {
    const core = coreOf(blocks[i]);
    if (blocks[i].value === '=') break;
    if (core === '(') depth++;
    else if (core === ')') { if (depth === 0) end = i; else depth--; }
  }
  return { start, end };
}

function newBlock(value) {
  return { id: idCounter++, value, active: false, dupIds: null, hintOf: null };
}

function isTimes(block) {
  return block !== undefined && block.hintOf === null && coreOf(block) === '×';
}

// Whether two blocks side by side multiply. An × says so outright, and so does one value
// written straight after another — "2" then "X" is 2X by the same rule that reads it. Digits
// spell one number out rather than multiplying, and a "(" opens a value the way a number is
// one, while everything else waits for a value instead of standing for one.
function multiplyBetween(left, right) {
  if (left === undefined || right === undefined) return false;
  if (left.hintOf !== null || right.hintOf !== null) return false;
  if (left.value === '=' || right.value === '=') return false;
  if (isTimes(left) || isTimes(right)) return true;
  if (continuesNumber(right, left)) return false;
  return holdsValue(left) && (holdsValue(right) || coreOf(right) === '(');
}

// The whole product a term is a factor of: everything multiplied into it, out to the far
// end of any group that reaches, with the sign of the lot in front. This is the term of a
// sum — 2X is one thing to add, not a 2 and an X — and so it is what crosses the "=" when
// there is a sum to cross out of.
function productAround(term) {
  let start = blocks.indexOf(term[0]);
  let end = start + term.length - 1;
  for (let growing = true; growing;) {
    growing = false;
    const bounds = groupAround(start, end);
    if (bounds.start !== start || bounds.end !== end) {
      ({ start, end } = bounds);
      growing = true;
    }
    if (start > 0 && multiplyBetween(blocks[start - 1], blocks[start])) { start--; growing = true; }
    if (end + 1 < blocks.length && multiplyBetween(blocks[end], blocks[end + 1])) { end++; growing = true; }
  }
  if (isSign(blocks[start - 1])) start--;
  return blocks.slice(start, end + 1);
}

// The × that joins a factor to what it multiplies, taken along with it — left behind it
// would stand between nothing and something, which reads as nothing at all.
function withTimes(term) {
  const start = blocks.indexOf(term[0]);
  const end = start + term.length - 1;
  if (isTimes(blocks[start - 1])) return blocks.slice(start - 1, end + 1);
  if (isTimes(blocks[end + 1])) return blocks.slice(start, end + 2);
  return term;
}

function equalsAt() {
  return blocks.findIndex(b => b.value === '=' && b.hintOf === null);
}

function sideOf(at) {
  const eq = equalsAt();
  return eq === -1 || at === -1 || at === eq ? null : (at < eq ? 'left' : 'right');
}

// What is written on one side of the "=", which is what a factor multiplies or divides all
// of. A value on show for a letter is an annotation rather than a term, and is left out.
function sideBlocks(side) {
  const eq = equalsAt();
  if (eq === -1) return [];
  const run = side === 'left' ? blocks.slice(0, eq) : blocks.slice(eq + 1);
  return run.filter(b => b.hintOf === null);
}

// Whether a run is one product — a single term, however many things are multiplied into it.
// A factor can only be taken across the "=" from a side like this: it multiplies the whole
// of what it leaves behind, so the whole of what it lands on is divided by it and the two
// sides go on saying the same thing. A sum has to be gathered before either of them can be.
// A sign at the front is the sign of that one term and leaves it one; one further in is
// what makes a sum of it.
function oneProduct(run) {
  if (run.length === 0) return false;
  let depth = 0;
  return run.every((block, i) => {
    const core = coreOf(block);
    if (core === '(') depth++;
    else if (core === ')') depth--;
    else if (depth === 0 && i > 0 && isSign(block)) return false;
    return true;
  });
}

// What shift takes hold of, and what crossing the "=" would make of it. A term of a sum
// crosses by turning its sign. On a side that is one product there is no sum to take a term
// from, so what it takes is the factor itself — and a factor crosses by turning into a
// divisor, which is the same equation written the other way round.
function carryOf(block) {
  const term = termOf(block);
  if (term.length === 0) return { run: term, as: 'sign' };
  const side = sideOf(blocks.indexOf(term[0]));
  const product = productAround(term);
  // A sign belongs to the whole term written after it, never to one factor of it: −6E is
  // minus six E, not minus six and then an E. So a signed piece is taken whole — leaving the
  // letter behind would carry off a term that was never there and the equation would stop
  // saying what it said.
  if (!isSign(term[0]) && side !== null && product.length > term.length && oneProduct(sideBlocks(side))) {
    return { run: withTimes(term), as: 'times' };
  }
  return { run: product, as: 'sign' };
}

// Whether a divisor can be taken out from under its bar at all: there has to be something
// written under it to take, and something on the other side for it to multiply.
function canLift(block, path) {
  const side = sideOf(blocks.indexOf(block));
  if (side === null || sideBlocks(side === 'left' ? 'right' : 'left').length === 0) return false;
  const text = halfAt(block.value, path);
  return text !== null && text !== '' && rewriteSlot(block, { kind: 'denominator', path }, null) !== null;
}

// The top-level terms of a run, each with the sign it is written with. What is inside
// brackets is part of the term holding them, however many signs are in it.
function termsOf(run) {
  const terms = [];
  let depth = 0;
  let term = [];
  run.forEach((block, i) => {
    const core = coreOf(block);
    if (depth === 0 && i > 0 && isSign(block)) {
      terms.push(term);
      term = [];
    }
    if (core === '(') depth++;
    else if (core === ')') depth--;
    term.push(block);
  });
  if (term.length > 0) terms.push(term);
  return terms;
}

// A divisor of one term among several cannot simply be handed to the other side — it divides
// only part of this one. It comes out the way a fraction is cleared with a pen instead, by
// multiplying every term on both sides by it: 5/C + 1 = 8 multiplied through reads
// 5 + 1 × C = 8 C. Its own term loses the bar, having been multiplied by what divided it,
// and every other term has it written in beside them.
function clearDivisor(host, path, from, to) {
  const receiving = sideBlocks(to);
  const text = halfAt(host.value, path);
  const rest = rewriteSlot(host, { kind: 'denominator', path }, null);
  if (receiving.length === 0 || text === null || text === '' || rest === null) return false;
  releaseAnswers(receiving);
  termsOf(sideBlocks(from)).forEach(term => {
    if (term.includes(host)) return;
    releaseAnswers(term);
    const factor = newBlock(text);
    enteringIds.add(String(factor.id));
    carryInto(term, factor);
  });
  host.value = rest;
  const crossing = newBlock(text);
  enteringIds.add(String(crossing.id));
  carryInto(receiving, crossing);
  refreshAnswers();
  render();
  return true;
}

// Shift takes a denominator on its own: it is lifted out from under the bar and carried as
// a block of its own, since a divisor is the one piece that crosses the "=" by turning into
// a multiplier. What it came out from is returned with it, to be put back under if the
// crossing falls through.
function liftDenominator(block, path) {
  const at = blocks.indexOf(block);
  if (at === -1 || !canLift(block, path)) return null;
  const text = halfAt(block.value, path);
  const rest = rewriteSlot(block, { kind: 'denominator', path }, null);
  const from = { id: block.id, value: block.value };
  const lifted = newBlock(text);
  enteringIds.add(String(lifted.id));
  block.value = rest;
  blocks.splice(at + 1, 0, lifted);
  return { lifted, from };
}

// Kept in the brackets it needs to read as one thing wherever it stands next: anything with
// an operator loose in it keeps its own, or what is written on it next would take the last
// term of it rather than all of it. A bar holds its own together and needs none — until it
// goes under another bar, which is what wholeValue brackets it for.
function bracketed(text) {
  if (strippedGroup(text) !== null) return text;
  return /[+−×÷]/.test(text) ? `(${text})` : text;
}

// What a carried run is written as where it goes under a bar — one piece of text, without
// the × that came along with it. A bar or a radical among several blocks is not a character
// that reads back, so a run holding one cannot be written out at all.
function factorText(run) {
  const values = run.filter(b => !isTimes(b));
  if (values.length === 0) return null;
  if (values.length > 1 && !gatherable(values)) return null;
  return wholeValue(bracketed(values.map(b => b.value).join('')));
}

// What a bar was holding together, written back out as the blocks it was gathered from once
// the bar has gone: the ÷ key gathers a group into one block to write it over a bar, and
// this is that undone. The brackets go with it where the group is all that is left on its
// side, since there is nothing beside it for them to hold it apart from — 5 = (5+6)/M with
// the M carried off reads 5 M = 5 + 6, and the brackets say nothing the line does not.
// Only text that could have been gathered is written back out: a bar or a hundredth is
// written onto a block rather than typed as a character of its own, and neither reads back
// as the block it came from.
function spellOut(block) {
  const side = sideOf(blocks.indexOf(block));
  const alone = side !== null && sideBlocks(side).length === 1;
  const inner = strippedGroup(block.value);
  if (inner === null && !alone) return;
  const text = inner !== null && alone ? inner : block.value;
  if (/[%/]/.test(text)) return;
  const run = textRun(text);
  if (run.map(p => p.value).join('') !== text) return;
  if (run.length < 2) {
    block.value = text;
    return;
  }
  const written = run.map(p => newBlock(p.value));
  written.forEach(b => enteringIds.add(String(b.id)));
  blocks.splice(blocks.indexOf(block), 1, ...written);
}

// A side bracketed before anything is written across all of it, so what goes on next takes
// the whole of it rather than the term it happens to stand next to.
function wrapSide(first, last) {
  const open = newBlock('(');
  const close = newBlock(')');
  enteringIds.add(String(open.id));
  enteringIds.add(String(close.id));
  blocks.splice(last + 1, 0, close);
  blocks.splice(first, 0, open);
  return close;
}

// Everything on a side written over one bar with what crossed beneath it. What goes over a
// bar is gathered into a single block, the way the ÷ key gathers what it is pressed on; a
// run holding a bar or a radical cannot be written out as text, so that one keeps its blocks
// and takes the bar under the bracket that closes it, which reads exactly the same.
function divideSide(run, text) {
  const first = blocks.indexOf(run[0]);
  const last = blocks.indexOf(run[run.length - 1]);
  if (first === last && holdsValue(run[0])) {
    run[0].value = wholeValue(run[0].value) + FRACTION + text;
    return;
  }
  if (gatherable(blocks.slice(first, last + 1))) {
    const target = run[run.length - 1];
    target.value = wholeValue(bracketed(gatherInto(first, last))) + FRACTION + text;
    return;
  }
  wrapSide(first, last).value = ')' + FRACTION + text;
}

// ...and a divisor put down where it multiplies everything on the side it crossed to. It is
// the very block that was carried over rather than one written out again, so it slides into
// place the way anything else that moves does. A sum is bracketed first, so all of it is
// multiplied rather than the term the block lands beside.
function carryInto(run, block) {
  blocks = blocks.filter(b => b !== block);
  block.value = bracketed(block.value);
  const end = oneProduct(run)
    ? blocks.indexOf(run[run.length - 1])
    : blocks.indexOf(wrapSide(blocks.indexOf(run[0]), blocks.indexOf(run[run.length - 1])));
  // Two values written side by side already multiply, so 5 and M put together read 5M with
  // nothing between them. A number needs the × even so: written against another it spells
  // one number rather than multiplying, and written against anything else it reads as a
  // product nobody writes that way.
  const bare = numericText(coreOf(block)) === null && multiplyBetween(blocks[end], block);
  const joins = bare ? [] : [newBlock('×')];
  joins.forEach(b => enteringIds.add(String(b.id)));
  blocks.splice(end + 1, 0, ...joins, block);
}

// A factor taken across the "=" divides everything it lands among, and a divisor multiplies
// it: 2X = 6 carried across reads X = 6 ÷ 2, which is as true as it was. Neither is written
// where it was dropped, the way a term is — what it does, it does to that whole side.
function crossOver(term, as, side, lifted) {
  const receiving = sideBlocks(side).filter(b => !term.includes(b));
  if (receiving.length === 0) return false;
  const host = lifted === null ? null : blocks.find(b => b.id === lifted.id);
  const text = as === 'over' ? null : factorText(term);
  if (as !== 'over' && text === null) return false;
  // What the "=" put down is written over, divided and multiplied here as readily as
  // anything else, and is no longer the answer it worked out once it has been, so the "="
  // lets go of it too.
  releaseAnswers(receiving);
  if (as === 'over') {
    carryInto(receiving, term[0]);
    if (host !== undefined && host !== null) {
      releaseAnswers([host]);
      spellOut(host);
    }
  } else {
    term.forEach(b => exitingIds.add(String(b.id)));
    blocks = blocks.filter(b => !term.includes(b));
    divideSide(receiving, text);
  }
  refreshAnswers();
  render();
  return true;
}

// A factor or a divisor that could not make the crossing goes back exactly where it came
// from: a divisor under the bar it was lifted out from, and a factor into the place it
// stood in. Neither has anywhere else it could be put down and go on meaning the same.
function putBack(term, lifted, at) {
  blocks = blocks.filter(b => !term.includes(b));
  if (lifted !== null) {
    const host = blocks.find(b => b.id === lifted.id);
    if (host) host.value = lifted.value;
  } else if (term.length > 0) {
    blocks.splice(Math.min(Math.max(at, 0), blocks.length), 0, ...term);
  }
  refreshAnswers();
  render();
}

// Lights what a shift-drag would carry, worked out the same way the drag works it out, so
// what lights up is what moves. The pieces are painted as one: each one reaches across the
// gap to the next, and only the two ends keep their outer corners.
let hovered = null;
let hoveredHalf = null;                       // ...or the denominator of one, taken on its own

function markCarry() {
  if (halfCarry !== null) return;             // a carry under way keeps its own green
  display.querySelectorAll('.block-carry').forEach(node =>
    node.classList.remove('block-carry', 'block-carry-first', 'block-carry-last'));
  display.querySelectorAll('.half-carry').forEach(node => node.classList.remove('half-carry'));
  if (!display.classList.contains('choosing') || hovered === null) return;
  const block = blocks.find(b => String(b.id) === hovered.dataset.id);
  if (!block || block.hintOf !== null) return;
  // A divisor is taken on its own, so it lights on its own — it is the one piece that
  // crosses the "=" by turning into a multiplier rather than by turning its sign, and it
  // only comes out from under the bar where it divides the whole of its side.
  const half = hoveredHalf === null ? null : clickedSlot(hovered, hoveredHalf);
  if (half !== null && half.kind === 'denominator' && canLift(block, half.path)) {
    hoveredHalf.classList.add('half-carry');
    return;
  }
  const carried = carryOf(block).run;
  carried.forEach((b, i) => {
    const node = nodeOf(b);
    if (node === null) return;
    node.classList.add('block-carry');
    if (i === 0) node.classList.add('block-carry-first');
    if (i === carried.length - 1) node.classList.add('block-carry-last');
  });
}

function nodeOf(block) {
  return display.querySelector(`.block[data-id="${block.id}"]`);
}

// Which side of the "=" the carried term is on, or null when there is no "=" for it to be
// on a side of.
function sideOfTerm() {
  return dragged.length === 0 ? null : sideOf(blocks.indexOf(dragged[0]));
}

// Which side of the "=" a point on the display is over — how a divisor is followed, since it
// is not moved among the blocks on its way across. Read off the "=" itself wherever the
// pointer is level with it, blank space and all: a side of an equation is everything to one
// hand of the "=", and letting go over the empty half of the display is letting go on that
// side. Only where the display has wrapped and the pointer is on some other row does it fall
// back to the block nearest it, which is the only thing that can tell those rows apart.
function sideAt(x, y) {
  const equals = equalsAt() === -1 ? null : nodeOf(blocks[equalsAt()]);
  if (equals !== null) {
    const box = equals.getBoundingClientRect();
    if (y > box.top - box.height && y < box.bottom + box.height) {
      return x < box.left + box.width / 2 ? 'left' : 'right';
    }
  }
  const nearest = findNearestBlock(x, y);
  if (!nearest.element) return null;
  const at = blocks.findIndex(b => String(b.id) === nearest.element.dataset.id);
  if (at === -1) return null;
  return at === equalsAt() ? (nearest.before ? 'left' : 'right') : sideOf(at);
}

// The side a divisor is being held over, lit while it is held there. Nothing in the display
// moves while one is carried — a divisor goes to a whole side at once, not to a place among
// the blocks — so the side lighting up is what says the carry has taken and where letting go
// will put it.
function markReceiving(side, from) {
  display.querySelectorAll('.block-taking').forEach(node => node.classList.remove('block-taking'));
  if (side === null || side === from) return;
  sideBlocks(side).forEach(b => {
    const node = nodeOf(b);
    if (node !== null) node.classList.add('block-taking');
  });
}

// A fraction is carried by hand rather than by the browser's own dragging. Holding shift is
// what tells a browser to reach for a selection instead of a drag, so on some of them a
// shift-drag never starts at all — the piece lights up green and then nothing happens,
// however willing the handlers behind it are. Following the pointer here instead takes that
// away: the press is claimed outright, and what happens after is ours the whole way.
//
// Which half was pressed says what is carried. The denominator is the divisor, and crosses
// the "=" on its own by turning into a multiplier. Anywhere else on a fraction — over the
// bar, or the bar itself — takes the fraction, all of it, wherever it is put down: what is
// written over a bar is no more a thing of its own than what is written under one.
function takeByHand(e) {
  if (!shiftOn(e) || ctrlOn(e) || e.button !== 0) return;
  const node = e.target.closest('.block');
  const block = node === null ? undefined : blocks.find(b => String(b.id) === node.dataset.id);
  if (block === undefined || block.hintOf !== null) return;
  if (splitFraction(block.value).under === null) return;
  const spot = clickedSlot(node, e.target);
  const held = spot !== null && spot.kind === 'denominator' && canLift(block, spot.path)
    ? e.target.closest('.denominator')
    : null;
  e.preventDefault();
  const from = sideOf(blocks.indexOf(block));
  if (held !== null) {
    halfCarry = { divisor: true, id: block.id, path: spot.path, from,
      ghost: showGhost([held.textContent], e.clientX, e.clientY) };
    held.classList.add('half-carry');
    return;
  }
  const run = carryOf(block).run;
  halfCarry = { divisor: false, run, from, at: blocks.indexOf(run[0]),
    ghost: showGhost(run.map(nodeOf).filter(n => n !== null), e.clientX, e.clientY) };
  markDragging(run);
}

// What is being carried, drawn under the pointer: copies of the very blocks, so it is a
// picture of the thing itself. The equation is left exactly as it reads until the carry is
// let go of somewhere that means something.
function showGhost(pieces, x, y) {
  const ghost = document.createElement('div');
  ghost.className = 'hand-ghost';
  pieces.forEach(piece => {
    if (typeof piece !== 'string') {
      ghost.appendChild(piece.cloneNode(true));
      return;
    }
    const one = document.createElement('div');
    one.className = 'block hand-half';
    one.textContent = piece;
    ghost.appendChild(one);
  });
  document.body.appendChild(ghost);
  moveGhost(ghost, x, y);
  return ghost;
}

function moveGhost(ghost, x, y) {
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

// The blocks a carry has taken hold of, faded where they stand until it is let go of. It is
// also what keeps them from being read as somewhere to put themselves down.
function markDragging(run) {
  run.forEach(b => {
    const node = nodeOf(b);
    if (node !== null) node.classList.add('dragging');
  });
}

// A carried fraction follows the pointer among the blocks the way a dragged one does: the
// gap opens where it would land, so where it is going is read off the display itself.
function moveRun(run, x, y) {
  if (!placeRun(run, x, y, true)) return;
  render();
  markDragging(run);
}

// Where a carried run goes when the pointer is here. Shift carries terms, and a term put
// down inside another one is not a term of anything: dropped between the − and the 6 of −6
// it would take the sign for itself and leave the 6 standing on nothing. So what shift
// carries lands in the gaps between terms and nowhere else, while a block dragged on its own
// still goes exactly where it was let go of.
function placeRun(run, x, y, asTerm) {
  const staying = blocks.filter(b => !run.includes(b));
  const at = asTerm ? edgeNearest(staying, x, y) : slotNearest(staying, x, y);
  if (at === null) return false;
  const next = [...staying.slice(0, at), ...run, ...staying.slice(at)];
  if (next.every((b, i) => b === blocks[i])) return false;
  blocks = next;
  return true;
}

function slotNearest(staying, x, y) {
  const nearest = findNearestBlock(x, y);
  if (!nearest.element) return staying.length;
  const at = staying.findIndex(b => String(b.id) === nearest.element.dataset.id);
  if (at === -1) return null;
  return nearest.before ? at : at + 1;
}

// The gap between terms nearest the pointer, measured to the gaps themselves rather than to
// the blocks either side of them — the space between two terms is what is being pointed at.
function edgeNearest(staying, x, y) {
  let best = { distance: Infinity, at: null };
  termEdges(staying).forEach(at => {
    const before = at > 0 ? nodeOf(staying[at - 1]) : null;
    const after = at < staying.length ? nodeOf(staying[at]) : null;
    const box = (before || after) === null ? null : (before || after).getBoundingClientRect();
    if (box === null) return;
    const beside = after === null ? null : after.getBoundingClientRect();
    const gapX = before === null ? box.left : beside === null ? box.right : (box.right + beside.left) / 2;
    const gapY = box.top + box.height / 2;
    const distance = (x - gapX) ** 2 + (y - gapY) ** 2;
    if (distance < best.distance) best = { distance, at };
  });
  return best.at;
}

// Every place a term may be put down: the two ends, and each gap between one term and the
// next. A + or − and the number it signs are one thing; so is everything inside a bracket,
// everything multiplied together, and every digit of one number. An answer on show belongs to
// the block it is about and nothing goes between them.
function termEdges(staying) {
  const edges = [0];
  let depth = 0;
  for (let i = 0; i < staying.length; i++) {
    const core = coreOf(staying[i]);
    if (core === '(') depth++;
    else if (core === ')') depth = Math.max(0, depth - 1);
    const next = staying[i + 1];
    if (next === undefined) break;
    if (depth > 0 || next.hintOf !== null) continue;
    const here = staying.slice(0, i + 1).reverse().find(b => b.hintOf === null);
    if (here === undefined) { edges.push(i + 1); continue; }
    if (isSign(here) || multiplyBetween(here, next) || continuesNumber(next, here)) continue;
    edges.push(i + 1);
  }
  edges.push(staying.length);
  return edges;
}

function dropCarry(carry, x, y) {
  if (!carry.divisor) {
    settleTerm(carry.run, carry.at, carry.from, true);
    return;
  }
  const side = sideAt(x, y);
  const host = blocks.find(b => b.id === carry.id);
  if (side === null || side === carry.from || host === undefined) return;
  // Where the divisor divides the whole of its side, it is lifted out and handed over as the
  // block it was — what is left behind reads as it did. Where it divides one term of a sum,
  // there is nothing to hand over: it has to be multiplied through instead.
  if (!oneProduct(sideBlocks(carry.from))) {
    clearDivisor(host, carry.path, carry.from, side);
    return;
  }
  const out = liftDenominator(host, carry.path);
  if (out === null) return;
  releaseAnswers([out.lifted]);
  if (!crossOver([out.lifted], 'over', side, out.from)) putBack([out.lifted], out.from, -1);
}

// Pointer events rather than mouse ones, so a finger follows a carried fraction the same way
// a cursor does. A mouse raises both sets, and a pointer event carries button and clientX/Y
// under the same names, so nothing about the cursor's behaviour changes by reading these.
display.addEventListener('pointerdown', takeByHand);
window.addEventListener('pointermove', e => {
  if (halfCarry === null) return;
  moveGhost(halfCarry.ghost, e.clientX, e.clientY);
  if (halfCarry.divisor) markReceiving(sideAt(e.clientX, e.clientY), halfCarry.from);
  else moveRun(halfCarry.run, e.clientX, e.clientY);
});
window.addEventListener('pointerup', e => {
  if (halfCarry === null) return;
  const carry = halfCarry;
  halfCarry = null;
  carry.ghost.remove();
  markReceiving(null, null);
  display.querySelectorAll('.half-carry').forEach(node => node.classList.remove('half-carry'));
  display.querySelectorAll('.dragging').forEach(node => node.classList.remove('dragging'));
  dropCarry(carry, e.clientX, e.clientY);
});

/* ============================================
   Carrying a block with a finger

   The browser's own dragging is what moves a block on a computer, and it is not raised from
   touch at all on iOS — the whole point of this machine, moving a term across the "=", was
   simply not there on a phone. What follows is the way in for a finger, and it takes the same
   three steps beginCarry / carryOver / endCarry that a mouse drag does.

   A press that travels is a drag, and the block follows the finger. A press that does not is
   a tap, and the block is lifted and waits: the next tap is where it goes. Both work, because
   a finger dragging something small over a small screen is fiddly and a term that waits can
   be aimed at leisure — and neither costs anything, since the difference between them is only
   whether the finger moved before it left.
   ============================================ */
const CARRY_SLOP = 8;                         // travelled less than this and it was a tap
let touchCarry = null;

function carriedNodes() {
  return dragged.map(nodeOf).filter(n => n !== null);
}

function endTouchCarry(x, y) {
  if (touchCarry !== null && touchCarry.ghost !== null) touchCarry.ghost.remove();
  touchCarry = null;
  if (dragged.length === 0) return;
  carryOver(x, y);
  endCarry();
}

if (onPhone) {
  display.addEventListener('pointerdown', e => {
    if (halfCarry !== null) return;           // a fraction is already being followed by hand

    // Something is held waiting to be put down, and this is where it goes.
    if (touchCarry !== null && touchCarry.held) {
      e.preventDefault();
      endTouchCarry(e.clientX, e.clientY);
      return;
    }
    // In edit mode a tap points the keypad rather than picking anything up, so the press is
    // left alone for the click handler that reads it.
    if (touchMods.ctrl) return;

    const node = e.target.closest('.block');
    if (node === null) return;
    const block = blocks.find(b => String(b.id) === node.dataset.id);
    if (block === undefined || block.hintOf !== null) return;
    // A lit "=" is a button before it is a block; a tap on it works the equation out.
    if (block.value === '=' && block.active) return;

    e.preventDefault();
    touchCarry = { pointerId: e.pointerId, block, x0: e.clientX, y0: e.clientY, moved: false, held: false, ghost: null };
  });

  window.addEventListener('pointermove', e => {
    if (touchCarry === null || touchCarry.held || e.pointerId !== touchCarry.pointerId) return;

    if (!touchCarry.moved) {
      if (Math.hypot(e.clientX - touchCarry.x0, e.clientY - touchCarry.y0) < CARRY_SLOP) return;
      touchCarry.moved = true;
      beginCarry(touchCarry.block, touchMods.shift);
      markDragging(dragged);
      touchCarry.ghost = showGhost(carriedNodes(), e.clientX, e.clientY);
    }
    moveGhost(touchCarry.ghost, e.clientX, e.clientY);
    carryOver(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', e => {
    if (touchCarry === null || e.pointerId !== touchCarry.pointerId) return;

    if (touchCarry.moved) {
      endTouchCarry(e.clientX, e.clientY);
      return;
    }
    if (touchCarry.held) return;
    // A tap: take hold of it and wait. The ghost stays under where the finger left, so what
    // is being carried is on show the whole time it is waiting.
    beginCarry(touchCarry.block, touchMods.shift);
    if (dragged.length === 0) { touchCarry = null; return; }
    markDragging(dragged);
    touchCarry.held = true;
    touchCarry.ghost = showGhost(carriedNodes(), e.clientX, e.clientY);
  });

  // A carry the browser takes back — a call arriving, the page going away — is put down where
  // it stood rather than left half lifted with the blocks faded behind it.
  window.addEventListener('pointercancel', () => {
    if (touchCarry === null) return;
    const at = startedAt;
    const term = dragged;
    if (touchCarry.ghost !== null) touchCarry.ghost.remove();
    touchCarry = null;
    display.querySelectorAll('.dragging').forEach(node => node.classList.remove('dragging'));
    dragged = [];
    carrying = false;
    carriedAs = 'sign';
    startedOn = null;
    startedAt = -1;
    if (term.length > 0) putBack(term, null, at);
  });

  /* ---------- the mode bar ----------
     Three switches standing in for two keys and the absence of them. Each says outright what
     the key it replaces does, because the whole difficulty with ctrl and shift here was that
     neither announced itself — the card in the corner exists for that same reason. */

  const modeBar = document.getElementById('calcModes');
  const modeSay = document.getElementById('calcModeSay');

  const MODES = {
    move:  { shift: false, ctrl: false, says: 'ลากบล็อกทีละตัวไปวางตรงไหนก็ได้ · แตะค้างไว้แล้วแตะที่หมายก็ได้' },
    shift: { shift: true,  ctrl: false, says: 'ยกทั้งพจน์ · ข้าม = แล้วกลับเครื่องหมายให้เอง · ที่ตัวส่วนคือยกตัวหารออก' },
    ctrl:  { shift: false, ctrl: true,  says: 'แตะเพื่อเล็งคีย์แพดไปที่ช่องนั้น · แตะเส้นเศษส่วนเป็นทศนิยม · แตะตัวอักษรเขียวดูคำตอบ' }
  };

  if (modeBar !== null) {
    const wearMode = name => {
      const on = MODES[name] || MODES.move;
      touchMods.shift = on.shift;
      touchMods.ctrl = on.ctrl;
      if (modeSay !== null) modeSay.textContent = on.says;
      modeBar.querySelectorAll('[data-mode]').forEach(b => {
        const is = b.dataset.mode === name;
        b.classList.toggle('active', is);
        b.setAttribute('aria-pressed', String(is));
      });
      // The green and blue the display lights up in are driven by these same two classes, so
      // a mode has to say the same thing to the display that holding the key would have.
      display.classList.toggle('picking', on.ctrl);
      display.classList.toggle('choosing', on.shift && !on.ctrl);
      markCarry();
    };

    modeBar.addEventListener('click', e => {
      const btn = e.target.closest('button[data-mode]');
      if (btn === null) return;
      wearMode(btn.dataset.mode);
    });

    modeBar.hidden = false;
    wearMode('move');
  }

  /* The list of answers behind a "N คำตอบ" label drops down on hover, which a finger never
     does. A tap opens it instead, and a second one puts it away. */
  display.addEventListener('click', e => {
    const label = e.target.closest('.block-listable');
    if (label === null) return;
    e.stopPropagation();
    label.classList.toggle('is-open');
  });
}

// An answer the "=" put down is kept in step with the equation it was worked out from,
// which holds only while it is where it was put. Carried off somewhere else it becomes a
// block like any other and the "=" lets go of it — otherwise it would go on rewriting a
// block that is now part of what it reads, and feed on itself.
function releaseAnswers(term) {
  blocks.forEach(b => {
    if (b.dupIds !== null && term.some(carried => b.dupIds.includes(carried.id))) b.dupIds = null;
  });
}

// A term taken from one side of an equation and put down on the other has to turn its sign
// for the two sides to go on saying the same thing: 4 + 5 = 9 carried across reads
// + 5 = 9 − 4, which is as true as it was. A term with no sign of its own was the first on
// its side and had none to turn, so crossing over gives it one.
function turnSign(term) {
  if (isSign(term[0])) {
    applyValueChange(() => { term[0].value = term[0].value === '+' ? MINUS : '+'; });
    return;
  }
  const sign = newBlock(MINUS);
  enteringIds.add(String(sign.id));
  blocks.splice(blocks.indexOf(term[0]), 0, sign);
  render();
}

// Two things written side by side with nothing between them do not read as two: values
// multiply and digits spell one number. A carried term keeps its own value wherever it
// lands, so where it comes to rest against another the + that says the sum carries on is
// written in — without it 5 − X put down in front of the 5 would read −X × 5 and the
// equation would stop being the one that was carried. A run that has just crossed the "="
// has been given a sign of its own already and needs none at its head.
function separateTerms(term, headToo) {
  const first = blocks.indexOf(term[0]);
  if (first === -1) return;
  const last = first + term.length - 1;
  const after = beside(last, 1);
  if (after !== -1 && runsTogether(blocks[last], blocks[after])) addSign(after);
  const before = beside(first, -1);
  if (headToo && !isSign(term[0]) && before !== -1 && runsTogether(blocks[before], blocks[first])) {
    addSign(first);
  }
}

// The block written next to this one, past any value on show for a letter — an annotation
// stands between two terms without separating them.
function beside(at, step) {
  for (let i = at + step; i >= 0 && i < blocks.length; i += step) {
    if (blocks[i].hintOf === null) return i;
  }
  return -1;
}

function runsTogether(left, right) {
  return multiplyBetween(left, right) || continuesNumber(right, left);
}

function addSign(at) {
  const sign = newBlock('+');
  enteringIds.add(String(sign.id));
  blocks.splice(at, 0, sign);
}

// A term let go of where it landed. What it does to the equation depends on nothing but
// where it came from and where it is now, so a term carried by hand and one dragged by the
// browser settle the same way: across the "=" it turns its sign, the side it was the last
// thing on reads nought, and whatever it has come to rest against is given the + that keeps
// the two of them two terms rather than one. A block dragged on its own — no shift — is put
// exactly where it was let go of and none of that applies.
function settleTerm(term, at, startedSide, asTerm) {
  const landedOn = term.length === 0 ? null : sideOf(blocks.indexOf(term[0]));
  const crossed = asTerm && startedSide !== null && landedOn !== null && landedOn !== startedSide;
  const moved = term.length > 0 && blocks.indexOf(term[0]) !== at;
  if (moved) {
    releaseAnswers(term);
    if (asTerm) separateTerms(term, !crossed);
    if (crossed) fillEmptySide(startedSide);
  }
  if (crossed) turnSign(term);
  else if (moved) render();
}

// A side with every term carried off it is not an empty side — it is nought, the sum of no
// terms at all. Writing that in leaves an equation there is still something to read: 5/C = 8
// with the 5/C carried across says 0 = 8 − 5/C, which answers to the same C it always did.
function fillEmptySide(side) {
  const eq = equalsAt();
  if (side === null || eq === -1 || sideBlocks(side).length > 0) return;
  const zero = newBlock('0');
  enteringIds.add(String(zero.id));
  blocks.splice(side === 'left' ? eq : eq + 1, 0, zero);
}

/* Taking hold of a block, letting go of it, and following it in between: three steps the
   browser's own dragging used to own outright. A finger cannot use them — dragstart is not
   raised from touch on iOS at all, and only unreliably on Android — so the same three steps
   are written here as functions, and the pointer path in the mobile section at the foot of
   this file walks through them in its own time. Neither way has a second copy of the
   reasoning; there is one carry, reachable two ways. */

// What shift takes hold of, taken hold of: the term rather than the block it was pressed on.
function beginCarry(block, asTerm) {
  carriedAs = 'sign';
  carrying = asTerm;
  if (!asTerm) dragged = [block];
  else ({ run: dragged, as: carriedAs } = carryOf(block));
  startedOn = sideOfTerm();
  startedAt = blocks.indexOf(dragged[0]);
}

// Where the carry would land if it were let go here: the gap opens live among the blocks
// staying put, and an "=" it is held over lights up and becomes pressable.
function carryOver(x, y) {
  if (dragged.length === 0) return;
  let changed = false;

  const nearest = findNearestBlock(x, y);
  if (nearest.element) {
    const nearestBlock = blocks.find(b => String(b.id) === nearest.element.dataset.id);
    if (nearestBlock && nearestBlock.value === '=' && !dragged.includes(nearestBlock) && !nearestBlock.active) {
      nearestBlock.active = true;
      changed = true;
    }
  }

  // Where the carried blocks land is worked out among the ones staying put, so a term of
  // two blocks slots in as one and the arithmetic of the indices stays the same either way.
  if (placeRun(dragged, x, y, carrying)) changed = true;

  if (changed) render();
}

function endCarry() {
  display.querySelectorAll('.dragging').forEach(node => node.classList.remove('dragging'));
  const landedOn = sideOfTerm();
  const crossed = carrying && startedOn !== null && landedOn !== null && landedOn !== startedOn;
  const asTerm = carrying;
  const term = dragged;
  const as = carriedAs;
  const leftBehind = startedOn;
  const from = startedAt;
  dragged = [];
  carrying = false;
  carriedAs = 'sign';
  startedOn = null;
  startedAt = -1;
  // A factor has only the one place to go: crossing turns it into a divisor, and anywhere
  // short of that leaves it multiplying something it was not, so a drag that stops there is
  // put back rather than half made.
  if (as !== 'sign') {
    if (crossed) releaseAnswers(term);
    if (!crossed || !crossOver(term, as, landedOn, null)) putBack(term, null, from);
    return;
  }
  settleTerm(term, from, leftBehind, asTerm);
}

function attachBlockHandlers(el) {
  el.addEventListener('dragstart', e => {
    const block = blocks.find(b => String(b.id) === el.dataset.id);
    if (!block) return;
    // Shift carries the term rather than the block, which is what it lights up. A divisor is
    // not carried this way at all — it is followed by hand, from the press onwards.
    beginCarry(block, shiftOn(e));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.id);
    requestAnimationFrame(() => markDragging(dragged));
  });
  el.addEventListener('dragend', endCarry);
  el.addEventListener('drop', e => e.preventDefault());
  el.addEventListener('click', e => {
    if (!ctrlOn(e)) return;
    // This listener is registered before render() assigns the "=" onclick, so stopping
    // immediately is what keeps a ctrl-click from also firing the equals action.
    e.preventDefault();
    e.stopImmediatePropagation();
    const block = blocks.find(b => String(b.id) === el.dataset.id);
    if (!block) return;
    // A decimal and the bar of a fraction each have one thing worth doing to them, so a
    // ctrl-click writes the one as the other rather than pointing the keypad at it.
    const spot = clickedSlot(el, e.target);
    if (spot !== null && spot.kind === 'bar') {
      convertToDecimal(block, spot.path);
      return;
    }
    // Brackets holding the same thing multiplied say it back as the power it is.
    if (spot === null && collapsePower(block)) return;
    // A letter that has an answer reads it out. Ctrl is what asks for it, the way ctrl asks
    // for everything else a block can be made to do — pressing one on its own is for taking
    // hold of it, so an answer never drops in on the way past.
    if (spot === null && el.classList.contains('block-var')) {
      handleVariableClick(block.id);
      return;
    }
    // Two numbers ctrl-clicked in turn run together before either is read as anything else.
    if (spot === null && mergeInto(block)) return;
    if (spot === null && convertToFraction(block)) return;
    // Otherwise ctrl-clicking points the keypad wherever the click landed — a block, an
    // exponent or a root index alike — and the keys type there until it is pointed away.
    const slot = spot || coreSlot(block);
    if (slot === null) return;
    const wasAimed = sameSlot(typingInto, block.id, slot);
    leaveSlot();
    // A square already pointed at is written out as what it stands for: the first ctrl-click
    // points the keypad at it, which is what an exponent that cannot be written out — a
    // letter, a fraction of one, a great many — goes on doing, and the next one opens it into
    // the brackets. Clicking away is what puts the keypad back, so nothing is lost by it.
    if (wasAimed && slot.kind === 'exponent' && expandPower(block, slot.slot)) return;
    if (!wasAimed && blocks.includes(block)) typingInto = { id: block.id, ...slot, fresh: true };
    render();
  });
}

// Finds the block whose center is closest to the cursor, and whether the
// cursor sits to its left/above (before) or right/below (after) it.
function findNearestBlock(x, y) {
  const candidates = [...display.querySelectorAll('.block:not(.dragging)')];
  let best = { distance: Infinity, element: null, before: false };
  candidates.forEach(child => {
    const box = child.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const distance = dx * dx + dy * dy;
    if (distance < best.distance) {
      best = { distance, element: child, before: dx < 0 };
    }
  });
  return best;
}

// While dragging over the display area (including empty space), figure out
// where the dragged block should land and open a gap there live.
display.addEventListener('dragover', e => {
  e.preventDefault();
  carryOver(e.clientX, e.clientY);
});

display.addEventListener('drop', e => e.preventDefault());

function render() {
  const solution = solveVariable();
  syncVariableHints(solution);
  drawGraph(solvePair());

  const firstRects = {};
  display.querySelectorAll('.block').forEach(el => {
    firstRects[el.dataset.id] = el.getBoundingClientRect();
  });

  const existing = {};
  display.querySelectorAll('.block').forEach(el => { existing[el.dataset.id] = el; });

  const currentIds = new Set(blocks.map(b => String(b.id)));
  Object.keys(existing).forEach(key => {
    if (currentIds.has(key)) return;
    const el = existing[key];
    if (exitingIds.has(key)) {
      // Pin the copy where it currently sits and take it out of the flow, so the
      // blocks that stay can close the gap right away — the mirror of the entrance,
      // where the copies claim their slot instantly and only the fade/slide animates.
      const box = firstRects[key];
      const host = display.getBoundingClientRect();
      el.style.position = 'absolute';
      el.style.left = `${box.left - host.left}px`;
      el.style.top = `${box.top - host.top}px`;
      el.style.width = `${box.width}px`;
      el.style.height = `${box.height}px`;
      el.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE_REVERSE}, opacity ${SLIDE_MS}ms ${SLIDE_EASE_REVERSE}`;
      el.style.transform = `translateX(${SLIDE_OFFSET})`;
      el.style.opacity = SLIDE_FADE;
      setTimeout(() => el.remove(), SLIDE_MS);
    } else {
      el.remove();
    }
  });

  blocks.forEach(b => {
    const key = String(b.id);
    let el = existing[key];
    const isNew = !el;
    if (!el) {
      el = document.createElement('div');
      el.className = 'block';
      // Native dragging is left off on a phone: it does not work there, and where Android
      // does start one from a long press it fights the pointer path that replaced it.
      el.draggable = !onPhone;
      el.dataset.id = key;
      attachBlockHandlers(el);
    }
    const aim = typingInto !== null && typingInto.id === b.id ? typingInto : null;
    writeValue(el, b.value, aim);
    const isEquals = b.value === '=';
    // The one letter of a solved equation lights up to say it has an answer, which a
    // ctrl-click reads out — including the block it was typed into, when it sits in an
    // exponent rather than standing on its own.
    const solvable = solution !== null && holdsVariable(b, solution.name);
    // An equation that reads but no real value satisfies says so at its letter, in red.
    const unsolved = solution !== null && solution.values.length === 0;
    el.classList.toggle('block-equals', isEquals);
    el.classList.toggle('active', isEquals && !!b.active);
    el.classList.toggle('block-var', solvable);
    el.classList.toggle('block-unsolved', unsolved && (solvable || b.hintOf !== null));
    el.classList.toggle('block-hint', b.hintOf !== null);
    el.classList.toggle('block-aimable', coreSlot(b) !== null);
    // A + or − is the sign of the term written after it, which is what shift reads them as.
    el.classList.toggle('block-sign', b.hintOf === null && (coreOf(b) === '+' || coreOf(b) === MINUS));
    // A fraction lights the half being typed into rather than the block around both.
    el.classList.toggle('typing', aim !== null && aim.kind === 'core');
    el.draggable = !onPhone && b.hintOf === null;
    const listable = b.hintOf !== null && solution !== null && solution.values.length > 1;
    el.classList.toggle('block-listable', listable);
    if (listable) writeAnswerList(el, solution.name, solution.values);
    if (isEquals && b.active) el.onclick = () => handleEqualsClick(b.id);
    else el.onclick = null;
    display.appendChild(el);

    if (isNew && enteringIds.has(key)) {
      el.style.transition = 'none';
      el.style.transform = `translateX(${SLIDE_OFFSET})`;
      el.style.opacity = SLIDE_FADE;
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASE}, opacity ${SLIDE_MS}ms ${SLIDE_EASE}`;
        el.style.transform = '';
        el.style.opacity = '';
      });
    }
  });

  display.querySelectorAll('.block').forEach(el => {
    if (exitingIds.has(el.dataset.id)) return;
    const first = firstRects[el.dataset.id];
    if (!first) return;
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx || dy) {
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 180ms ease';
        el.style.transform = '';
      });
    }
  });

  enteringIds = new Set();
  exitingIds = new Set();
}

// The slot a ctrl-click aimed the keypad at, as { id, kind, slot }, or null while typing
// lands at the end of the display as usual.
let typingInto = null;

function sameSlot(aim, id, slot) {
  if (aim === null || aim.id !== id || aim.kind !== slot.kind) return false;
  if (slot.path === undefined) return aim.slot === slot.slot;
  return aim.path !== undefined
    && aim.path.length === slot.path.length
    && aim.path.every((step, i) => step === slot.path[i]);
}

// Ctrl points the keypad at a block to type over it. A value on show for a letter is an
// annotation rather than something written, and an "=" holds on to what it worked out, so
// neither takes the keypad — their exponents and root indexes still do.
function canAim(block) {
  return block.hintOf === null && block.value !== '=';
}

// Where a ctrl-click on the body of a block points the keypad. Typing over a bracket only
// ever breaks the pair, so a bracket hands the keypad on to the square or root written on
// it — which is what there is to edit, and far too small to aim at on its own — and takes
// nothing at all when it carries neither.
function coreSlot(block) {
  if (!canAim(block)) return null;
  const core = coreOf(block);
  if (core === '(' || core === ')') {
    const levels = splitLevels(splitFraction(block.value).main);
    if (levels.length > 1) return { kind: 'exponent', slot: 1 };
    const { indexes } = splitRoots(levels[0]);
    return indexes.length > 0 ? { kind: 'root', slot: 0 } : null;
  }
  // What is over a bar is a slot of its own, written into rather than typed over.
  return splitFraction(block.value).under === null
    ? { kind: 'core', slot: 0 }
    : { kind: 'numerator', path: ['numerator'] };
}

// Puts the keypad back on the end of the display. An emptied block stands for nothing, so
// it goes with the keypad rather than staying on as a gap — an emptied exponent or root
// index keeps its block, which still reads as itself.
function leaveSlot() {
  if (typingInto === null) return;
  const block = blocks.find(b => b.id === typingInto.id);
  const aim = typingInto;
  typingInto = null;
  if (!block) return;
  // Nothing under the bar is no fraction, so the bar goes when the keypad leaves it.
  if (aim.kind === 'denominator' && slotText(block, aim) === '') {
    const dropped = rewriteSlot(block, aim, null);
    if (dropped !== null) block.value = dropped;
    return;
  }
  // Nothing over it stands for nothing at all, so the block goes with it.
  if (aim.kind === 'numerator' && slotText(block, aim) === '' && splitFraction(block.value).main === '') {
    exitingIds.add(String(block.id));
    blocks = blocks.filter(b => b.id !== block.id);
    return;
  }
  if (coreOf(block) !== '') return;
  exitingIds.add(String(block.id));
  blocks = blocks.filter(b => b.id !== block.id);
}

// What a slot holds, or null once it is gone from under the keypad.
function slotText(block, aim) {
  if (aim.kind === 'denominator' || aim.kind === 'numerator') return halfAt(block.value, aim.path);
  const { main } = splitFraction(block.value);
  const levels = splitLevels(main);
  if (aim.kind === 'exponent') return aim.slot < levels.length ? levels[aim.slot] : null;
  const { indexes, core } = splitRoots(levels[0]);
  if (aim.kind === 'core') return core;
  return aim.slot < indexes.length ? indexes[aim.slot] : null;
}

// The block value with that slot rewritten, or with the slot dropped when `text` is null:
// an exponent takes anything written above it along, a root just goes.
function rewriteSlot(block, aim, text) {
  const { main, under } = splitFraction(block.value);
  if (aim.kind === 'denominator' || aim.kind === 'numerator') {
    // A denominator dropped takes its bar with it, leaving what was written over it — the
    // bar of whichever fraction that half belongs to, however deep in it is.
    if (text === null && aim.kind === 'denominator') {
      const above = aim.path.slice(0, -1);
      const fraction = halfAt(block.value, above);
      return fraction === null ? null : rewriteHalfAt(block.value, above, splitFraction(fraction).main);
    }
    return rewriteHalfAt(block.value, aim.path, text === null ? '' : text);
  }

  const levels = splitLevels(main);
  if (aim.kind === 'exponent') {
    if (text === null) levels.splice(aim.slot);
    else levels[aim.slot] = text;
  } else {
    const { indexes, core } = splitRoots(levels[0]);
    if (aim.kind === 'core') {
      levels[0] = joinRoots(indexes, text);
    } else {
      if (text === null) indexes.splice(aim.slot, 1);
      else indexes[aim.slot] = text;
      levels[0] = joinRoots(indexes, core);
    }
  }
  const rewritten = levels.join(LEVEL);
  return under === null ? rewritten : rewritten + FRACTION + under;
}

// The simplest fraction that reads as the same number, found by taking the number apart a
// whole at a time and building the fraction back up from what that leaves. It stops as
// soon as one lands within a hair of the number, so 0.333333333333 comes back a third
// rather than three hundred and thirty three billion over a trillion — twelve figures is
// all the display ever showed of it. Returns null when nothing simple enough fits.
const FRACTION_LIMIT = 10000;

function asFraction(value) {
  const sign = value < 0 ? -1 : 1;
  let left = Math.abs(value);
  let [lastTop, top] = [0, 1];
  let [lastBottom, bottom] = [1, 0];

  for (let i = 0; i < 32; i++) {
    const whole = Math.floor(left);
    [lastTop, top] = [top, whole * top + lastTop];
    [lastBottom, bottom] = [bottom, whole * bottom + lastBottom];
    if (bottom > FRACTION_LIMIT) return null;
    if (bottom !== 0 && Math.abs(top / bottom - Math.abs(value)) <= 1e-10 * Math.abs(value)) {
      return { top: sign * top, bottom };
    }
    const over = left - whole;
    if (over === 0) return null;              // it was a whole number all along
    left = 1 / over;
  }
  return null;
}

// The blocks a merge can run together: ones that spell out a number and nothing else, so
// 4 and 5 become 45. An operator, a fraction, a square or a letter is not part of the
// number beside it, and ctrl-clicking one points the keypad at it as it always did.
function spellsNumber(block, leading) {
  const { main, under } = splitFraction(block.value);
  if (under !== null || block.hintOf !== null) return false;
  const [base, ...exponents] = splitLevels(main);
  if (exponents.length > 0) return false;
  const { indexes, core } = splitRoots(base);
  if (indexes.length > 0) return false;
  // A minus belongs to the number it is written in front of, so it joins in at the front
  // of a run and nowhere else — one further in would be a subtraction between two numbers,
  // which is not one number at all.
  return leading ? /^−?[0-9.]+$/.test(core) : /^[0-9.]+$/.test(core);
}

// Ctrl-clicking a second number while the keypad is on one runs everything from the one to
// the other into a single block, which is what a number typed digit by digit was meant to
// be all along. The keypad stays on what they became, so the next one along joins it too.
// Whether the "−" standing at this block reads as the sign of what comes after it rather
// than as a subtraction between two numbers: nothing before it, or something that is
// still waiting for a value.
function signHere(index) {
  if (index === 0) return true;
  const before = coreOf(blocks[index - 1]);
  return before === '(' || OPERATORS[before] !== undefined;
}

function mergeInto(block) {
  if (typingInto === null || typingInto.kind !== 'core') return false;
  const from = blocks.findIndex(b => b.id === typingInto.id);
  const to = blocks.indexOf(block);
  if (from === -1 || to === -1 || from === to) return false;
  let [start, end] = from < to ? [from, to] : [to, from];

  // A "−" at the front of the run joins the number as its sign. Where it is a subtraction
  // it is left where it is and only the digits run together, since taking it into the
  // number would quietly turn "1 − 45" into one times minus forty five.
  const opensWithSign = coreOf(blocks[start]) === MINUS && signHere(start);
  if (coreOf(blocks[start]) === MINUS && !opensWithSign) start++;
  if (start >= end) return false;

  const run = blocks.slice(start, end + 1);
  const numbers = opensWithSign ? run.slice(1) : run;
  if (!numbers.every((b, i) => spellsNumber(b, i === 0 && !opensWithSign))) return false;

  const target = blocks[end];
  const joined = gatherInto(start, end);
  typingInto = { id: target.id, kind: 'core', slot: 0, fresh: false };
  applyValueChange(() => { target.value = joined; });
  return true;
}

// Ctrl-clicking a decimal writes it as the fraction it stands for: 0.5 is a half. Only a
// plain decimal standing on its own converts — anything already written as a fraction, a
// root or a tower is written as something, and takes the keypad instead.
function convertToFraction(block) {
  const { main, under } = splitFraction(block.value);
  if (under !== null || splitLevels(main).length > 1) return false;
  const { indexes, core } = splitRoots(main);
  if (indexes.length > 0) return false;
  const text = numericText(core);
  if (text === null) return false;
  const value = Number(text);
  if (!Number.isFinite(value) || Number.isInteger(value)) return false;
  const parts = asFraction(value);
  if (parts === null) return false;
  applyValueChange(() => { block.value = `${formatNumber(parts.top)}${FRACTION}${parts.bottom}`; });
  return true;
}

// ...and ctrl-clicking the bar writes the fraction back out as the number it comes to, so
// the two readings are a click apart either way. A fraction still holding a letter has no
// number to be written as, and stays as it is.
function convertToDecimal(block, path) {
  // The bar pressed is the bar of one particular fraction, which may be written inside
  // another, so only what that bar holds together is written back out as a number.
  const text = halfAt(block.value, path);
  if (text === null) return false;
  const term = readHalf(text, null, []);
  if (term === null || degreeOf(term) > 0) return false;
  const written = rewriteHalfAt(block.value, path, formatNumber(term[0]));
  if (written === null) return false;
  applyValueChange(() => { block.value = written; });
  return true;
}

// A power written out as what it stands for. Ctrl-clicking the square of 9² gives (9 × 9),
// each nine a block of its own to read and edit, the way ctrl-clicking a bar writes a
// fraction out as a number. Only whole powers can be written this way, and only small ones —
// past a handful the writing says less than the power did — so every other exponent goes on
// taking the keypad from a ctrl-click as it always has.
const MAX_WRITTEN_POWER = 8;

function expandPower(block, slot) {
  const at = blocks.indexOf(block);
  if (at === -1 || slot !== 1) return false;
  // The base is everything the square is written over, which is not always the one block it
  // is written on: a square on a closing bracket squares all the brackets hold, and one on
  // the last digit of 9.5 squares the whole of 9.5. That is the same reach the ÷ and √ keys
  // are written with, so a power is written out over exactly what it was taken of.
  const start = reachOf(at);
  const value = blocks.slice(start, at).map(b => b.value).join('') + block.value;
  const { main, under } = splitFraction(value);
  const levels = splitLevels(main);
  if (under !== null || levels.length !== 2 || levels[0] === '') return false;
  // Brackets that could not be gathered still stand for blocks outside this one, and what
  // those say cannot be multiplied out from here.
  if (splitRoots(levels[0]).core === ')') return false;
  const times = Number(levels[1]);
  if (!Number.isInteger(times) || times < 2 || times > MAX_WRITTEN_POWER) return false;
  const written = [newBlock('(')];
  for (let i = 0; i < times; i++) {
    if (i > 0) written.push(newBlock('×'));
    written.push(newBlock(levels[0]));
  }
  written.push(newBlock(')'));
  written.forEach(b => enteringIds.add(String(b.id)));
  blocks.splice(start, at - start + 1, ...written);
  refreshAnswers();
  render();
  return true;
}

// ...and ctrl-clicking either bracket of the same thing multiplied by itself writes it back
// as the power it is, so the two readings are a click apart either way. Anything else in
// brackets is not a power and is left alone.
function collapsePower(block) {
  const core = coreOf(block);
  const at = blocks.indexOf(block);
  if ((core !== '(' && core !== ')') || at === -1) return false;
  const open = core === '(' ? at : matchingOpen(blocks, at);
  const close = core === '(' ? matchingClose(blocks, at) : at;
  if (open === -1 || close === -1) return false;
  const inner = blocks.slice(open + 1, close);
  const base = inner.length === 0 ? null : inner[0].value;
  const repeated = inner.length >= 3 && inner.length % 2 === 1
    && inner.every((b, i) => b.hintOf === null && (i % 2 === 0 ? b.value === base : isTimes(b)));
  if (!repeated) return false;
  const written = newBlock(wholeValue(bracketed(base)) + LEVEL + (inner.length + 1) / 2);
  enteringIds.add(String(written.id));
  blocks.splice(open, close - open + 1, written);
  refreshAnswers();
  render();
  return true;
}

// Whether a key belongs in the slot the keypad is pointed at, or is the display carrying
// on past it. An exponent or a root index is an expression in its own right and takes
// anything typeable — 4² can be made 4¹², 4²⁺³ or 4ⁿ. A denominator takes what a number is
// made of, and an operator after one is the expression carrying on past the fraction: half
// plus a half, not half of two plus a half. An opening bracket says otherwise, though, so
// while one is open under the bar everything goes on under it — 1 ÷ ( 2 + 3 ) is a fifth —
// until it closes again.
function openDepth(text) {
  return [...text].reduce((depth, ch) => depth + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 0);
}

function slotTakes(aim, text, key) {
  if (!/^[0-9.+−×÷()A-Z]$/.test(key)) return false;
  // Only the keypad landing under the bar by itself, straight off the ÷ key, reads an
  // operator as leaving. Pointing it at a slot is asking to write there, so what is typed
  // stays put until the keypad is pointed somewhere else.
  if (aim.kind !== 'denominator' || !aim.auto) return true;
  if (/^[0-9.A-Z(]$/.test(key)) return true;
  return openDepth(text) > 0;
}

// What a slot reads after a key lands in it. The first key after ctrl-click types over
// what is there, the way typing over a selection does — that is the point of aiming at a
// slot. After that an exponent or a root index takes keys on the end, since each is a
// little expression written out key by key, while a block's core stands for one term, so
// only a digit carries a number on — 9 then 5 is 95 — and anything else takes its place.
function typedText(text, key, aim) {
  if (aim.fresh) return key;
  if (aim.kind !== 'core') return text + key;
  return numericText(text) !== null && /^[0-9.]$/.test(key) ? text + key : key;
}

// Half of a fraction as a run to read: what is written over or under a bar is a term of
// its own, and either a single block's worth — a number, a square, a root — or an
// expression typed out character by character, which is what the second reading covers.
function fractionRun(text) {
  return [{ value: text, hintOf: null }];
}
function readHalf(text, variable, known) {
  const inner = strippedGroup(text);
  if (inner !== null) return readHalf(inner, variable, known);
  const asBlock = readTerms(fractionRun(text), variable, known);
  if (asBlock !== null) return asBlock;
  return readTerms(textRun(text), variable, known);
}

// Where the keypad is pointed, if it is pointed at a slot this block still has.
function typingTarget() {
  if (typingInto === null) return null;
  const block = blocks.find(b => b.id === typingInto.id);
  if (!block || slotText(block, typingInto) === null) {
    typingInto = null;                        // the slot went away under it
    return null;
  }
  return block;
}

function action(v) {
  const target = typingTarget();
  if (target !== null) {
    const aim = typingInto;
    const text = slotText(target, aim);
    if (slotTakes(aim, text, v)) {
      const written = typedText(text, v, aim);
      aim.fresh = false;                      // only the first key types over the slot
      applyValueChange(() => { target.value = rewriteSlot(target, aim, written); });
      return;
    }
  }
  leaveSlot();
  blocks.push({ id: idCounter++, value: v, active: v === '=', dupIds: null, hintOf: null });
  render();
}

// Deleting takes a digit off an exponent before it takes the block itself, so a square
// added by mistake can be undone without retyping what it was written on. It works on
// the exponent the keypad is pointed at, or on the top of the last block's tower.
function backspace() {
  const target = typingTarget();
  if (target !== null) {
    const aim = typingInto;
    const text = slotText(target, aim);
    aim.fresh = false;                        // what is left has been kept on purpose
    // Emptying the slot the keypad is pointed at leaves it there to keep typing into, so
    // what is written can be replaced without losing the place it was written in.
    if (text !== '') {
      applyValueChange(() => { target.value = rewriteSlot(target, aim, text.slice(0, -1)); });
      return;
    }
    // Backspacing an already empty one takes the slot away — and a core is the block, so
    // that takes the block, while an exponent or a root index just goes from it.
    typingInto = null;
    if (aim.kind !== 'core') {
      applyValueChange(() => { target.value = rewriteSlot(target, aim, null); });
      return;
    }
    exitingIds = new Set([String(target.id)]);
    blocks = blocks.filter(b => b.id !== target.id);
    render();
    return;
  }
  const block = blocks[blocks.length - 1];
  if (!block) return;
  // With nothing aimed at, it takes the top off the last block's tower before the block.
  const { main, under } = splitFraction(block.value);
  const levels = splitLevels(main);
  if (levels.length > 1) {
    levels.pop();
    const shortened = levels.join(LEVEL) + (under === null ? '' : FRACTION + under);
    applyValueChange(() => { block.value = shortened; });
    return;
  }
  blocks.pop();
  render();
}
// CE takes back the entry, where C takes back the lot. What an entry is on a display of
// blocks is the term rather than the block: 4 then 5 is the one number forty five, and a +
// and what it signs is the one thing that was added — taking those apart a block at a time
// is what the backspace key is for. So it lifts out the term the keypad is pointed at, or
// the last one written when it is pointed nowhere, which is the entry still being made.
function clearEntry() {
  const aimed = typingTarget();
  const anchor = aimed !== null
    ? aimed
    : [...blocks].reverse().find(b => b.hintOf === null);
  typingInto = null;
  if (anchor === undefined) return;
  const term = termOf(anchor);
  if (term.length === 0) return;
  // The "=" worked its answer out from blocks that are about to go, so it lets go of it
  // first — otherwise it would go on rewriting a block that is no longer there.
  releaseAnswers(term);
  term.forEach(b => exitingIds.add(String(b.id)));
  blocks = blocks.filter(b => !term.includes(b));
  // A value on show for a letter whose block has just gone is cleared by syncVariableHints()
  // at the top of render(), so there is nothing to do about it here.
  refreshAnswers();
  render();
}
function clearAll() {
  typingInto = null;
  blocks = [];
  render();
}

const OPERATORS = {
  '×': (a, b) => a * b,
  '÷': (a, b) => a / b,
  '+': (a, b) => a + b,
  '−': (a, b) => a - b,
};

// Digit and "." blocks spell one number out across several blocks ("1" then "2"
// is 12), while an answer block already holds a whole number and can carry the
// keypad's minus sign — so it reads back as a number if it is reused later.
function numericText(value) {
  if (/^[0-9.]+$/.test(value)) return value;
  if (/^−[0-9.]+$/.test(value)) return '-' + value.slice(1);
  return null;
}

const LEVEL = '^';

// The x² key writes onto the block to its left rather than landing as a block of its
// own, so a block value can carry a tower of exponents, each level written on the one
// before it: "4^2" is 4², "4^2^2" is 4 raised to 2². Nothing else a block can hold uses
// "^", so a plain value splits to a single level and reads exactly as it always did.
function splitLevels(value) {
  return value.split(LEVEL);
}

// The % key writes onto what is already there, the way x² does, so a block can hold "50%".
// It is read as what it says — a number of hundredths — wherever it turns up.
const PERCENT = '%';
const PERCENT_SCALE = 0.01;

const FRACTION = '/';

// The ÷ key stacks what is already there over what is typed next, the way a fraction is
// written by hand, so a block can hold "8/9". Everything before the slash is what the
// block held anyway — roots, squares and all — and everything after is the denominator
// typed under the bar. Nothing typeable is a slash, so a value without one reads exactly
// as it always did.
function splitFraction(value) {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    // A block can hold a closing bracket with no opening one, being the block that closes
    // a group the others opened, so the count is held at nothing rather than going under.
    else if (value[i] === ')') depth = Math.max(0, depth - 1);
    // The bar of this fraction is the first one outside any brackets. One inside them
    // belongs to a fraction written into this one, and is that one's to split on.
    else if (value[i] === FRACTION && depth === 0) {
      return { main: value.slice(0, i), under: value.slice(i + 1) };
    }
  }
  return { main: value, under: null };
}

// The inside of a group that wraps the whole of a text, or null when it does not — the
// brackets a fraction written inside another is kept in, which the bar makes unnecessary
// to draw and unnecessary to read twice.
function strippedGroup(text) {
  if (!text.startsWith('(') || !text.endsWith(')')) return null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i === text.length - 1 ? text.slice(1, -1) : null;
  }
  return null;
}

// A fraction written into something else keeps its brackets, so the bar, root or square
// that goes on next takes all of it rather than splitting it apart.
function wholeValue(value) {
  return splitFraction(value).under === null ? value : `(${value})`;
}

// A half is reached by the steps that lead to it — ["numerator", "denominator"] is what is
// under the bar of the fraction written over this one's bar. An empty path is the value
// itself, which is what makes the steps compose: each one drops into a half and reads on.
function halfAt(value, path) {
  if (path.length === 0) return value;
  const { main, under } = splitFraction(value);
  if (under === null) return null;
  const half = path[0] === 'numerator' ? main : under;
  // The half the path ends at is read as it is written, brackets and all — they are part
  // of what is typed there. Only a half being stepped through is opened up, to read on.
  if (path.length === 1) return half;
  const inner = strippedGroup(half);
  return halfAt(inner === null ? half : inner, path.slice(1));
}

// ...and written back the same way, with every half it passes through kept bracketed if
// it is a fraction itself, so the bars stay where they were.
function rewriteHalfAt(value, path, text) {
  if (path.length === 0) return text;
  const { main, under } = splitFraction(value);
  if (under === null) return null;
  const half = path[0] === 'numerator' ? main : under;
  const inner = strippedGroup(half);
  const rewritten = rewriteHalfAt(inner === null ? half : inner, path.slice(1), text);
  if (rewritten === null) return null;
  const kept = wholeValue(rewritten);
  return path[0] === 'numerator' ? `${kept}${FRACTION}${under}` : `${main}${FRACTION}${kept}`;
}

const ROOT = '√';
const ROOT_END = '|';

// A root is written in front of what it takes, the way an exponent is written above it:
// its index, then the radical sign, so "√3|8" is ³√8. They stack — "√2|√2|16" is the
// square root of a square root. The index is typed like an exponent, and nothing typeable
// closes it, which is what lets "²√x" stay the plain label a block can be stepped onto.
function splitRoots(base) {
  const indexes = [];
  let core = base;
  while (core.startsWith(ROOT)) {
    const end = core.indexOf(ROOT_END);
    if (end === -1) break;
    indexes.push(core.slice(ROOT.length, end));
    core = core.slice(end + ROOT_END.length);
  }
  return { indexes, core };
}

function joinRoots(indexes, core) {
  return indexes.map(index => ROOT + index + ROOT_END).join('') + core;
}

// Trims float noise down to what a block would show, so ³√8 reads 2 rather than
// 1.9999999999999998 and stops that crumb spreading into everything built on it.
function roundForDisplay(n) {
  return parseFloat(n.toPrecision(12));
}

// A negative number raised to a fraction is NaN, so an odd root of one — which does have
// a real answer — is taken from its size and signed back: ³√−8 is −2.
function nthRoot(value, degree) {
  if (degree === 0) return null;
  if (value >= 0) return roundForDisplay(value ** (1 / degree));
  if (!Number.isInteger(degree) || degree % 2 === 0) return null;
  return -roundForDisplay((-value) ** (1 / degree));
}

// A block standing for a value is read as it is drawn: the tower above it raises it, then
// each root in front takes it back down, innermost first — the one written closest to the
// number takes it before the ones wrapped around that. Returns null when a level has no
// value, or when the result runs off the end of what a double holds.
function towerValue(n, indexes, exponents, known) {
  const exponent = towerExponent(exponents, known);
  if (exponent === null) return null;
  let value = n ** exponent;
  for (let i = indexes.length - 1; i >= 0; i--) {
    const degree = evaluateText(indexes[i], known);
    if (degree === null) return null;
    value = nthRoot(value, degree);
    if (value === null) return null;
  }
  return Number.isFinite(value) ? value : null;
}

// A block is written the way it would be by hand: what it is divided by sits under a bar,
// and above that, each root index raised in front of its radical sign, then the number,
// then the exponents stacked, each sitting on the one below. `aim` marks the slot the
// keypad is typing into, if any.
// The aim as it reads inside a half: a step shorter, or nothing when it was not headed
// this way. A path with no steps left is this half itself, the one being typed into.
function aimInto(aim, step) {
  if (aim === null || aim.path === undefined || aim.path[0] !== step) return null;
  return { ...aim, path: aim.path.slice(1) };
}
function aimsHere(aim) {
  return aim !== null && aim.path !== undefined && aim.path.length === 0;
}

function writeValue(el, value, aim = null) {
  el.textContent = '';
  const { main, under } = splitFraction(value);
  if (under !== null) {
    const overAim = aimInto(aim, 'numerator');
    const underAim = aimInto(aim, 'denominator');
    const stack = document.createElement('span');
    stack.className = 'fraction';
    const over = document.createElement('span');
    over.className = 'numerator';
    // Over the bar and under it are each their own slot to type into, so the one being
    // typed into lights on its own — lighting the whole block would say both.
    if (aimsHere(overAim)) over.classList.add('typing');
    writeHalf(over, main, overAim);
    // The bar is drawn as a piece of its own rather than as an edge of what sits on it,
    // since it is what a ctrl-click takes hold of to write the fraction back out as a
    // number, and an edge cannot be pointed at.
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.dataset.bar = '';
    const below = document.createElement('span');
    below.className = 'denominator';
    below.dataset.denominator = '';
    if (aimsHere(underAim)) below.classList.add('typing');
    writeHalf(below, under, underAim);
    stack.append(over, bar, below);
    el.appendChild(stack);
    return;
  }
  writeTerm(el, main, aim);
}

// Half of a fraction drawn the way it reads. A fraction written into it draws itself, over
// its own bar — the brackets it is kept in are what the bar says, so they are not drawn
// again — and anything else is either an expression typed out or a block's worth of value.
function writeHalf(el, text, aim) {
  if (splitFraction(text).under !== null) {
    writeValue(el, text, aim);      // the aim carries on down into the halves of this one
    return;
  }
  const inner = strippedGroup(text);
  if (inner !== null) {
    writeHalf(el, inner, aim);
    return;
  }
  if (/[+−×÷()]/.test(text)) writeText(el, text);
  else writeTerm(el, text, aim);
}

// Slot text drawn the way it reads: what a "^" takes is raised above what it was written
// on, so "8−D^2" is drawn 8 − D² — the same rule textRun reads it by.
function writeText(el, text) {
  let host = el;
  let index = null;                           // a root's index, raised in front of its sign
  [...text].forEach(ch => {
    if (index !== null) {
      if (ch === ROOT_END) {
        el.appendChild(document.createTextNode(ROOT));
        index = null;
      } else index.appendChild(document.createTextNode(ch));
      return;
    }
    if (ch === ROOT) {
      index = el.appendChild(document.createElement('sup'));
      host = el;
      return;
    }
    if (ch === LEVEL && host === el && el.lastChild !== null) {
      host = el.appendChild(document.createElement('sup'));
      return;
    }
    if (host !== el && !/[0-9.]/.test(ch)) host = el;
    host.appendChild(document.createTextNode(ch));
  });
}

function writeTerm(el, value, aim) {
  const levels = splitLevels(value);
  // A minus in front of a radical is the sign of what the radical comes to, not a part of
  // what is under it — −²√9 is minus three — so it is written out before the roots are read
  // off what follows it, which they only can be from the front.
  const signed = levels[0].startsWith(MINUS) && levels[0].slice(1).startsWith(ROOT);
  if (signed) el.appendChild(document.createTextNode(MINUS));
  const { indexes, core } = splitRoots(signed ? levels[0].slice(1) : levels[0]);
  indexes.forEach((index, slot) => {
    const sup = document.createElement('sup');
    sup.dataset.root = slot;
    sup.textContent = index;
    if (aim !== null && aim.kind === 'root' && aim.slot === slot) sup.className = 'typing';
    el.appendChild(sup);
    el.appendChild(document.createTextNode(ROOT));
  });
  el.appendChild(document.createTextNode(core));

  let host = el;
  for (let i = 1; i < levels.length; i++) {
    const sup = document.createElement('sup');
    sup.textContent = levels[i];
    if (aim !== null && aim.kind === 'exponent' && aim.slot === i) sup.className = 'typing';
    host.appendChild(sup);
    host = sup;
  }
}

// Which slot of a block a click landed in, or null for the block itself. A root index
// says which one it is outright, since they sit side by side; exponents are counted by
// the <sup>s between the click and the block, each being written on the one below it.
function clickedSlot(el, target) {
  const path = [];
  let bar = false;
  let root = null;
  let level = 0;

  for (let node = target; node && node !== el; node = node.parentElement) {
    if (node.dataset.bar !== undefined) bar = true;
    else if (node.classList.contains('numerator')) path.unshift('numerator');
    else if (node.classList.contains('denominator')) path.unshift('denominator');
    else if (node.tagName === 'SUP') {
      if (node.dataset.root !== undefined) root = Number(node.dataset.root);
      else level++;
    }
  }
  // A half wins over anything found inside it: a square written into one is part of what
  // that half says, not a slot of the block around it.
  if (bar) return { kind: 'bar', path };
  if (path.length > 0) return { kind: path[path.length - 1], path };
  if (root !== null) return { kind: 'root', slot: root };
  return level > 0 ? { kind: 'exponent', slot: level } : null;
}

// An exponent is typed as text rather than built out of blocks, so it is read back
// through the same walk as the display itself, each character standing in for the block
// it was typed from: "2+3" in an exponent reads 5, with × and ÷ binding first as usual.
// A letter reads only against a settled value for it — 2ˣ is not a·x + b, so a letter
// with no value yet leaves the whole exponent unreadable.
function evaluateText(text, known = []) {
  const term = readTerms(textRun(text), null, known);
  return term === null ? null : term[0];
}

// Text typed into a slot is read a character at a time, since that is how it was typed —
// except for a "^" the x² key put there, which takes the digits after it and binds them to
// the character before, so "8−D^2" reads as 8 − D² and "(8−D)^2" as the whole bracket
// squared, exactly as those read on the display itself.
function textRun(text) {
  const run = [];
  let raising = false;
  let root = '';                              // a root being read, then waiting to land
  let reading = false;

  [...text].forEach(ch => {
    if (reading) {                            // ...its index, up to the mark that closes it
      root += ch;
      if (ch === ROOT_END) reading = false;
      return;
    }
    if (ch === ROOT) {
      root = ch;
      reading = true;
      return;
    }
    const last = run[run.length - 1];
    if (root === '' && ch === LEVEL && last !== undefined) {
      last.value += ch;
      raising = true;
      return;
    }
    if (root === '' && raising && /[0-9.]/.test(ch)) {
      last.value += ch;
      return;
    }
    raising = false;
    run.push({ value: root + ch, hintOf: null });   // a root lands on what follows it
    root = '';
  });
  if (root !== '') run.push({ value: root, hintOf: null });   // nothing followed it
  return run;
}

// ...and the tower is read the same way it is drawn, from the top down: 4^2^2 raises 4
// by 2², not by 2 twice over. Returns null when a level holds something with no value,
// and the exponent runs to infinity — leaving the run unevaluable either way — once a
// tower grows past what a double can hold.
function towerExponent(levels, known = []) {
  let exponent = 1;
  for (let i = levels.length - 1; i >= 0; i--) {
    const n = evaluateText(levels[i], known);
    if (n === null || !Number.isFinite(n)) return null;
    exponent = n ** exponent;
  }
  return exponent;
}

// Display text for a computed number (0.1 + 0.2 reads 0.3, not 0.30000000000000004),
// signed with the same minus glyph as the keypad.
function formatNumber(n) {
  const text = String(roundForDisplay(n));
  return text.startsWith('-') ? '−' + text.slice(1) : text;
}

// A run of blocks reads as a polynomial in the letter, held as coefficients from the
// constant up: [3, 2] is 2x + 3 and [9, 6, 1] is (x + 3)². Plain arithmetic is just the
// case with nothing past the constant, so the same walk serves the "=" and the solver.
// Eight is as far as it goes — room for a good many brackets multiplied together, while
// still bounding the work a single block can ask for.
const MAX_DEGREE = 8;

function trimTerm(p) {
  while (p.length > 1 && p[p.length - 1] === 0) p.pop();
  return p;
}
function degreeOf(p) {
  return p.length - 1;
}
function valueAt(p, x) {
  return p.reduce((sum, c, i) => sum + c * x ** i, 0);
}

function addTerms(p, q, sign) {
  const out = [];
  for (let i = 0; i < Math.max(p.length, q.length); i++) out.push((p[i] || 0) + sign * (q[i] || 0));
  return trimTerm(out);
}
function mulTerms(p, q) {
  if (degreeOf(p) + degreeOf(q) > MAX_DEGREE) return null;   // x·x·x is out of reach
  const out = new Array(p.length + q.length - 1).fill(0);
  p.forEach((c, i) => q.forEach((d, j) => { out[i + j] += c * d; }));
  return trimTerm(out);
}
function divTerms(p, q) {
  if (degreeOf(q) > 0 || q[0] === 0) return null;            // dividing by the unknown, or by zero
  return trimTerm(p.map(c => c / q[0]));
}
function powTerms(p, n) {
  if (!Number.isInteger(n) || n < 0) return null;
  let out = [1];
  for (let i = 0; i < n; i++) {
    out = mulTerms(out, p);
    if (out === null) return null;
  }
  return out;
}

// What something comes to with a root in front of it and an exponent above. A whole
// number power of a run still holding the letter multiplies out — (x + 3)² is x² + 6x + 9
// — while anything else needs a plain number to work on, and a run still holding the
// letter is not one.
function raisedTerm(term, indexes, exponents, known) {
  if (degreeOf(term) > 0 && indexes.length === 0) {
    const power = towerExponent(exponents, known);
    const raised = power === null ? null : powTerms(term, power);
    if (raised !== null) return raised;
  }
  if (degreeOf(term) > 0) return null;
  const value = towerValue(term[0], indexes, exponents, known);
  return value === null ? null : [value];
}

// What a block stands for with anything written around it stripped off — the "9" of a
// "√2|9²", or the bracket of a ")²".
function coreOf(block) {
  return splitRoots(splitLevels(splitFraction(block.value).main)[0]).core;
}

// The bracket that closes the one at `start`, or that opens the one at `close`, counting
// depth so a group inside a group pairs up with its own.
function matchingClose(run, start) {
  let depth = 0;
  for (let i = start; i < run.length; i++) {
    const core = coreOf(run[i]);
    if (core === '(') depth++;
    else if (core === ')' && --depth === 0) return i;
  }
  return -1;
}

function matchingOpen(run, close) {
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    const core = coreOf(run[i]);
    if (core === ')') depth++;
    else if (core === '(' && --depth === 0) return i;
  }
  return -1;
}

// Reads a run of blocks as a polynomial in `variable` — pass null when there is no unknown
// left, which then only accepts what comes to a plain number. `known` is the values already
// settled for other letters, as [{ name, value }]: how the second letter of a pair reads
// while the first is being worked out, and the only way a letter reads at all where no
// polynomial reading reaches it, inside an exponent or a root index. Returns null if the
// run holds anything else (%, an unsettled letter), is malformed ("1+"), climbs past the
// degree that can be worked with, or has no finite value ("1÷0").
function readTerms(run, variable, known = []) {
  const parts = [];
  let numText = '';
  let numRoots = [];

  // Digit blocks spell one number out across several blocks, so they only become a
  // term once something that is not a digit turns up. Squaring raises whatever the
  // number spells out by then.
  const flushNumber = (exponents = [], scale = 1) => {
    if (numText === '') return true;
    const n = Number(numText);
    const roots = numRoots;
    numText = '';
    numRoots = [];
    if (!Number.isFinite(n)) return false;
    const term = raisedTerm([n * scale], roots, exponents, known);
    if (term === null) return false;
    parts.push({ term });
    return true;
  };

  for (let i = 0; i < run.length; i++) {
    const block = run[i];
    const { main, under } = splitFraction(block.value);
    if (under !== null) {
      // A fraction stands for one value of its own, so it closes the number in front of it
      // rather than joining it: "1" then "2/3" is 1 × ⅔.
      if (!flushNumber()) return null;
      // Both halves are read the same way, so either can hold what the other can — a
      // fraction under the bar as readily as one over it.
      const top = readHalf(main, variable, known);
      const bottom = readHalf(under, variable, known);
      if (top === null || bottom === null) return null;
      const term = divTerms(top, bottom);
      if (term === null) return null;
      parts.push({ term });
      continue;
    }
    const [base, ...exponents] = splitLevels(main);
    const { indexes, core } = splitRoots(base);
    // A "%" written on the end says what is under it is that many hundredths, whatever
    // that is — a number, a letter, or a bracket gathered into one block.
    const percent = core.length > 1 && core.endsWith(PERCENT);
    const bare = percent ? core.slice(0, -1) : core;
    // The hundredth is taken before anything written around it, so (50%)² is a quarter
    // rather than twenty five: what the % is on is the value, and the square is of that.
    const scale = percent ? PERCENT_SCALE : 1;
    const scaled = term => (scale === 1 ? term : term.map(c => c * scale));

    const digits = numericText(bare);
    if (digits !== null) {
      // A root is written in front of the whole number it takes, so it closes the number
      // running up to it and starts a new one: "√1" then "6" is √16, not √1 × 6.
      if (indexes.length > 0 && !flushNumber()) return null;
      numText += digits;
      if (indexes.length > 0) numRoots = indexes;
      // A "%" closes the number it ends, and so does an exponent written on one: "1" then
      // "2²" is 12², not 1 × 2².
      if (percent) {
        if (!flushNumber(exponents, scale)) return null;
      } else if (exponents.length > 0 && !flushNumber(exponents)) return null;
      continue;
    }
    if (!flushNumber()) return null;
    if (bare === '(') {
      // A group reads on its own and stands in for one term, so "2" then "(1 + 3)" is
      // 2 × 4 by the same rule that multiplies any two terms sitting side by side.
      const close = matchingClose(run, i);
      if (close === -1) return null;
      const inner = readTerms(run.slice(i + 1, close), variable, known);
      if (inner === null) return null;
      const closing = splitFraction(run[close].value);
      const closeExponents = splitLevels(closing.main).slice(1);
      if (exponents.length > 0) return null;   // nothing is ever written above a "("
      // A root in front of the group and a square behind it apply to what it comes to.
      let term = indexes.length === 0 && closeExponents.length === 0
        ? inner
        : raisedTerm(inner, indexes, closeExponents, known);
      if (term === null) return null;
      // ...and so does a bar under the bracket that closes it: (1 + 2)/3 is one.
      if (closing.under !== null) {
        const bottom = readHalf(closing.under, variable, known);
        term = bottom === null ? null : divTerms(term, bottom);
        if (term === null) return null;
      }
      parts.push({ term });
      i = close;
      continue;
    }
    const settled = known.find(k => k.name === bare);
    if (settled !== undefined) {
      // A letter already stood at a value reads as that value, whatever is written on it.
      const term = raisedTerm(scaled([settled.value]), indexes, exponents, known);
      if (term === null) return null;
      parts.push({ term });
    } else if (variable !== null && bare === variable) {
      const term = raisedTerm(scaled([0, 1]), indexes, exponents, known);
      if (term === null) return null;
      parts.push({ term });
    } else if (indexes.length === 0 && exponents.length === 0 && OPERATORS[bare]) {
      parts.push({ op: bare });
    } else if (bare.length > 1) {
      // A whole expression gathered into one block — the bracket a bar or a radical was
      // written across — reads as the text it was gathered from, with whatever is written
      // around it applied to what that comes to. One character has already been read as
      // itself by here, so only longer cores are worth reading again this way.
      const inner = strippedGroup(bare);
      const gathered = inner === null
        ? readTerms(textRun(bare), variable, known)
        : readTerms([{ value: inner, hintOf: null }], variable, known);
      if (gathered === null) return null;
      const term = raisedTerm(scaled(gathered), indexes, exponents, known);
      if (term === null) return null;
      parts.push({ term });
    } else return null;
  }
  if (!flushNumber()) return null;

  const values = [];
  const ops = [];
  let sign = 1;
  let wantValue = true;

  for (const part of parts) {
    if (part.op) {
      if (!wantValue) {
        ops.push(part.op);
        wantValue = true;
        continue;
      }
      // An operator with no left operand is only a sign: "−" turns what follows, "+"
      // leaves it as it is, and anything else has nothing to work on.
      if (part.op === MINUS) sign = -sign;
      else if (part.op !== '+') return null;
      continue;
    }
    if (!wantValue) ops.push('×');            // two terms in a row multiply: "5" then "x"
    values.push(sign === 1 ? part.term : part.term.map(c => -c));
    sign = 1;
    wantValue = false;
    // × and ÷ bind tighter, so fold them the moment their right operand lands.
    while (ops.length && (ops[ops.length - 1] === '×' || ops[ops.length - 1] === '÷')) {
      const right = values.pop();
      const left = values.pop();
      const folded = ops.pop() === '×' ? mulTerms(left, right) : divTerms(left, right);
      if (folded === null) return null;
      values.push(folded);
    }
  }
  if (wantValue) return null;                 // empty run or trailing operator

  let result = values[0];
  for (let i = 0; i < ops.length; i++) {
    result = addTerms(result, values[i + 1], ops[i] === '+' ? 1 : -1);
  }
  if (!result.every(Number.isFinite)) return null;
  return result;
}

// Reads a run of blocks as arithmetic and returns its value. Returns null if the run
// holds anything else (a letter, x², %), is malformed ("1+"), or has no finite value
// ("1÷0") — the "=" then falls back to duplicating the run instead.
function evaluateBlocks(head) {
  const term = readTerms(head, null);
  return term === null ? null : term[0];
}

// What an "=" should put on its right so both sides read the same: just the answer when
// the right side is empty, otherwise the term that closes the gap — 4 + 1 = 2 gains
// "+ 3". Returns null when either side is not plain arithmetic.
function balancingValues(head, tail) {
  const answer = evaluateBlocks(head);
  if (answer === null) return null;
  const rightSide = tail.length === 0 ? null : evaluateBlocks(tail);
  // Nothing to balance against — an empty right side, or one holding something that is
  // not arithmetic — so the answer stands on its own.
  if (rightSide === null) return [formatNumber(answer)];
  const gap = answer - rightSide;
  return [gap < 0 ? '−' : '+', formatNumber(Math.abs(gap))];
}

// Pressing an activated "=" block slides in whatever makes the two sides match, with a
// fade: the answer, or the term that closes the gap when the right side already holds
// something, or a copy of the run when it is not arithmetic at all. Pressing it again
// pulls whatever slid in back out.
function handleEqualsClick(id) {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx === -1) return;
  const eqBlock = blocks[idx];
  if (!eqBlock.active) return;

  if (eqBlock.dupIds) {
    const dupSet = new Set(eqBlock.dupIds);
    exitingIds = new Set(eqBlock.dupIds.map(String));
    blocks = blocks.filter(b => !dupSet.has(b.id));
    eqBlock.dupIds = null;
  } else {
    // A shown variable value is an annotation, so the "=" reads straight past it.
    const head = blocks.slice(0, idx).filter(b => b.hintOf === null);
    if (head.length === 0) return;
    const values = balancingValues(head, blocks.slice(idx + 1).filter(b => b.hintOf === null));
    const incoming = values === null
      ? head.map(b => ({ id: idCounter++, value: b.value, active: b.value === '=', dupIds: null, hintOf: null }))
      : values.map(v => ({ id: idCounter++, value: v, active: false, dupIds: null, hintOf: null }));
    eqBlock.dupIds = incoming.map(c => c.id);
    enteringIds = new Set(eqBlock.dupIds.map(String));
    // A balancing term lands after what is already on the right; copies still go
    // straight behind the "=".
    blocks.splice(values === null ? idx + 1 : blocks.length, 0, ...incoming);
  }
  render();
}

const VARIABLE = /^[A-Z]$/;

// A letter is a block of its own when it stands as a term, but inside an exponent it is
// one character among the others that were typed there, so both places have to be read.
function variableNames(terms) {
  const names = new Set();
  terms.forEach(b => {
    const { indexes, core } = splitRoots(splitLevels(splitFraction(b.value).main)[0]);
    if (VARIABLE.test(core)) names.add(core);
    typedTexts(b).concat(indexes).forEach(text =>
      [...text].forEach(ch => { if (VARIABLE.test(ch)) names.add(ch); }));
  });
  return names;
}

// Every part of a block written out as text rather than as a block of its own: exponents,
// root indexes, and — where a bar makes each half a slot to write in — what is over and
// under it. A letter can be anywhere in these, so they are read a character at a time.
function typedTexts(block) {
  const { main, under } = splitFraction(block.value);
  const [base, ...exponents] = splitLevels(main);
  const { indexes, core } = splitRoots(base);
  // The core is in here too, since a bracket gathered under a root or over a bar keeps its
  // whole expression there — the K of a "√(K − 6)" is as much on show as any other.
  const texts = [...exponents, ...indexes, core];
  if (under !== null) texts.push(main, under);
  return texts;
}

function holdsVariable(block, name) {
  const { indexes, core } = splitRoots(splitLevels(splitFraction(block.value).main)[0]);
  return core === name
    || typedTexts(block).concat(indexes).some(text => text.includes(name));
}

// What a run comes to when the letter stands for `value` — including where the letter
// sits in an exponent, which no polynomial reading reaches.
function evaluateAt(run, name, value) {
  const term = readTerms(run, null, [{ name, value }]);
  return term === null ? null : term[0];
}

// Values to compare the two sides at, spread geometrically so an exponent has room to
// overtake whatever sits beside it without spending probes on ground already crossed. The
// ladder climbs in as far as it climbs out, because a letter under a bar answers to the
// reciprocal of what it would answer to over one — 5 = 2/E says what 5E = 2 says, and its
// answer is a fifth as far out — so the ground between nought and one has to be trodden as
// finely as the ground beyond it, or a divisor is looked for where it could never be.
const PROBE_OUT = 7;                          // 2⁷, far enough out for an exponent to run away
const PROBE_IN = -16;                         // 2⁻¹⁶, far enough in for a divisor to be met
const PROBE_LADDER = Array.from({ length: PROBE_OUT - PROBE_IN + 1 }, (_, i) => 2 ** (PROBE_OUT - i));
const PROBES = [...PROBE_LADDER.map(v => -v), 0, ...[...PROBE_LADDER].reverse()];
const PROBE_STEPS_IN = 8;                     // halvings toward a candidate that came to nothing
const HALVINGS = 60;

// Closes in on the crossing between two values the sides straddle, by halving.
function bisect(gapAt, low, high, lowGap, halvings) {
  for (let i = 0; i < halvings; i++) {
    const mid = (low + high) / 2;
    const gap = gapAt(mid);
    if (gap === null) return null;
    if (gap === 0) return mid;
    if (Math.sign(gap) === Math.sign(lowGap)) {
      low = mid;
      lowGap = gap;
    } else high = mid;
  }
  return (low + high) / 2;
}

// The two sides read at every candidate. A candidate where they cannot be compared at all —
// under a bar that comes to nothing there, or inside a root of a negative — is dropped, and
// dropping it would join the two stretches it stood between into one that steps over it: a
// crossing just to either side would go unseen, since only neighbours are compared. So each
// dropped candidate is looked for again halfway to each of its neighbours, near enough that
// whatever it fell foul of lies between the two — 5 = 2/(E+1) has nothing to say at −1 and
// says it at −0.6, which is found from −0.75 rather than across the hole.
function sampleAround(gapAt, probes) {
  const samples = [];
  probes.forEach((probe, i) => {
    const gap = gapAt(probe);
    if (gap !== null) {
      samples.push({ probe, gap });
      return;
    }
    [i - 1, i + 1].forEach(beside => {
      const neighbour = probes[beside];
      if (neighbour === undefined) return;
      const from = gapAt(neighbour);
      let near = neighbour;
      // Halving in from the neighbour rather than stepping evenly, since what is being
      // looked for lies against the hole: 5 = 2/(E−2) turns over between 2 and 2.4, which
      // is a fifth of the way in from the 4 beside it. Closing in stops as soon as the
      // sides have turned over — that is the crossing bracketed, and closer says no more —
      // or as soon as they stop reading, which is ground they do not reach at all.
      for (let step = 0; step < PROBE_STEPS_IN; step++) {
        near = (near + probe) / 2;
        const nearGap = gapAt(near);
        if (nearGap === null) break;
        samples.push({ probe: near, gap: nearGap });
        if (from !== null && Math.sign(nearGap) !== Math.sign(from)) break;
      }
    });
  });
  return samples.sort((a, b) => a.probe - b.probe);
}

// With the letter in an exponent there is no rearranging the equation, so the two sides
// are compared at candidate values and every crossing is closed in on instead: 2ˣ = 8 is
// bracketed between 2 and 4, then halved onto 3. Only clean crossings count, which leaves
// equations the letter has no say in (both sides matching everywhere) and ones it can
// never satisfy, without an answer.
function crossingsOf(gapAt, probes, halvings) {
  const samples = sampleAround(gapAt, probes);
  const zeros = samples.filter(s => s.gap === 0);
  // The sides meeting at more than one candidate is the letter making no difference to
  // them, which is not an equation with no answer but no equation about it at all.
  if (zeros.length > 1) return null;
  const found = zeros.map(s => s.probe);

  for (let i = 1; i < samples.length; i++) {
    const before = samples[i - 1];
    const after = samples[i];
    if (Math.sign(after.gap) === Math.sign(before.gap)) continue;
    const root = bisect(gapAt, before.probe, after.probe, before.gap, halvings);
    if (root === null) continue;
    // Two candidates can straddle a jump rather than a crossing (a ÷ that passes through
    // zero), and halving onto one of those lands nowhere, so each one found is checked.
    // The mark is well clear of what halving leaves behind, since what it is looking for
    // is a gap that stayed the size of the jump rather than one that closed.
    const gap = gapAt(root);
    const scale = Math.max(1, Math.abs(before.gap), Math.abs(after.gap));
    if (gap !== null && Math.abs(gap) <= scale * 1e-4) found.push(writeCrossing(gapAt, root));
  }
  // A candidate that landed exactly on a crossing is also a sign change against each of
  // its neighbours, so the same value is reached from more than one side.
  return found.sort((a, b) => a - b)
    .filter((v, i, all) => i === 0 || Math.abs(v - all[i - 1]) > 1e-7 * Math.max(1, Math.abs(v)));
}

// Halving lands as close to a crossing as the two sides can be read, which is not all the
// way: every root and power in them is rounded to twelve figures, so the gap between them
// comes in steps of about that size and halving stops on the edge of a step rather than on
// the crossing — ²√(9C)/3 = 1 comes back 0.999999999998. So the crossing is written in the
// fewest figures that leave the gap no wider than the steps already leave it: a value that
// really does run on keeps every figure it has earned, and one that was only ever a whole
// number written the long way reads as the whole number it is.
function writeCrossing(gapAt, root) {
  const step = Math.max(Math.abs(root), 1) * 1e-11;
  const rise = gapAt(root + step);
  const fall = gapAt(root - step);
  if (rise === null || fall === null) return root;
  const noise = Math.max(Math.abs(rise), Math.abs(fall));
  for (let digits = 9; digits <= 12; digits++) {
    const written = Number(root.toPrecision(digits));
    const gap = gapAt(written);
    if (gap !== null && Math.abs(gap) <= noise) return written;
  }
  return root;
}

// Values where the sides meet, or null when the two sides could not be compared anywhere —
// which is the difference between an equation with no answer and no equation at all.
function solveNumerically(head, tail, name) {
  const gapAt = x => {
    const left = evaluateAt(head, name, x);
    const right = evaluateAt(tail, name, x);
    if (left === null || right === null) return null;
    const gap = left - right;
    return Number.isFinite(gap) ? gap : null;
  };
  const found = crossingsOf(gapAt, PROBES, HALVINGS);
  if (found === null) return null;
  if (found.length > 0) return found;
  return PROBES.some(probe => gapAt(probe) !== null) ? [] : null;
}

function derivative(p) {
  return trimTerm(p.slice(1).map((c, i) => c * (i + 1)));
}

// No root can lie outside this, so it is where the search starts and stops.
function rootBound(p) {
  const lead = Math.abs(p[p.length - 1]);
  return 1 + Math.max(...p.slice(0, -1).map(c => Math.abs(c) / lead), 0);
}

// How large the terms are at x, which is what "comes to zero" has to be measured against:
// a leftover of 1e-9 is nothing beside terms in the millions, and everything beside terms
// in the millionths.
function magnitudeAt(p, x) {
  return p.reduce((sum, c, i) => sum + Math.abs(c) * Math.abs(x) ** i, 0);
}
function isZeroAt(p, x) {
  return Math.abs(valueAt(p, x)) <= 1e-9 * Math.max(1, magnitudeAt(p, x));
}

// How far off a crossing could be and still not be told apart from it. Adding terms that
// cancel loses figures, so the curve near its own zero is only known to about the size of
// its terms times what a double drops; divided by the slope, that is a distance along x.
function wobbleAt(p, x) {
  const slope = Math.abs(valueAt(derivative(p), x));
  return slope === 0 ? 0 : (magnitudeAt(p, x) * 1e-14) / slope;
}

// The one place a stretch of curve going one way can cross zero, if it crosses at all.
// Halving stops at `fineness` of the crossing's own size, or at the last bit a double can
// hold when that is asked for, whichever comes first.
function crossingIn(p, low, high, fineness) {
  if (isZeroAt(p, low)) return low;
  if (isZeroAt(p, high)) return high;
  let lowValue = valueAt(p, low);
  if (Math.sign(lowValue) === Math.sign(valueAt(p, high))) return null;

  for (let i = 0; i < 80; i++) {
    const middle = (low + high) / 2;
    if (middle === low || middle === high) break;
    if (high - low <= fineness * Math.max(1, Math.abs(middle))) break;
    const value = valueAt(p, middle);
    if (value === 0) return middle;
    if (Math.sign(value) === Math.sign(lowValue)) {
      low = middle;
      lowValue = value;
    } else high = middle;
  }

  // Halving lands as close as the curve can be read, which for a polynomial with large
  // coefficients is not all the way — (x−1)…(x−8) cannot tell 6 from 5.99999999998. So the
  // crossing is written in the fewest figures that still land inside what it is known to,
  // which turns that back into 6 while leaving a root that really does run on, like √2,
  // every figure it has earned.
  const root = (low + high) / 2;
  const wobble = wobbleAt(p, root);
  for (let digits = 10; digits <= 12; digits++) {
    const written = parseFloat(root.toPrecision(digits));
    if (Math.abs(written - root) <= wobble) return written;
  }
  return root;
}

// Every value a polynomial comes to zero at. The line is split at the turning points,
// since between two of them the curve only goes one way and so crosses at most once; the
// turning points are where the derivative is zero, which is one degree lower and found the
// same way. A root the curve only touches rather than crosses — the repeated bracket of
// (x + 5)(x + 2)(x + 2) — is a turning point itself, so it is not missed. A constant says
// nothing about the letter: x + 1 = x + 2 never balances, and 5 = 5 always does.
// `fineness` is how close counts as found, as a fraction of the root's own size: an answer
// on show wants every figure it can get, so it asks for none, while the graph only needs
// the pixel the root lands in and pays for the halvings it skips.
function polynomialRoots(p, fineness = 0) {
  const term = trimTerm([...p]);
  if (degreeOf(term) <= 0) return [];
  if (degreeOf(term) === 1) return [-term[0] / term[1]];

  const bound = rootBound(term);
  const turns = polynomialRoots(derivative(term), fineness).filter(v => Math.abs(v) < bound);
  const edges = [-bound, ...turns, bound];
  const roots = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const root = crossingIn(term, edges[i], edges[i + 1], fineness);
    if (root !== null) roots.push(root);
  }
  // A root sitting on a turning point is found from both sides, so it turns up twice.
  return roots.sort((a, b) => a - b)
    .filter((v, i, all) => i === 0 || Math.abs(v - all[i - 1]) > 1e-7 * Math.max(1, Math.abs(v)));
}

// A display holding one letter and an "=" is an equation, and a complete one solves to
// the values that letter can stand for: 5x + 4 = 5 leaves x = 0.2, and (x + 3)² = 4
// leaves both −5 and −1. A letter the equation can only be read at rather than
// rearranged for — one inside an exponent, as in 2ˣ = 8 — falls to solveNumerically.
// Returns null when there is no "=", no letter (or more than one kind), a side that reads
// as nothing at all, or nothing to pin the letter down to.
function solveVariable() {
  const terms = blocks.filter(b => b.hintOf === null);
  const names = variableNames(terms);
  if (names.size !== 1) return null;
  const name = [...names][0];

  const eqIndex = terms.findIndex(b => b.value === '=');
  if (eqIndex === -1) return null;
  const head = terms.slice(0, eqIndex);
  const tail = terms.slice(eqIndex + 1);

  const left = readTerms(head, name);
  const right = readTerms(tail, name);
  if (left !== null && right !== null) {
    const gap = addTerms(left, right, -1);
    // A gap that stays zero whatever the letter stands for is not an equation about it at
    // all — every value fits, so there is nothing to say. An empty list of values is the
    // other thing: an equation that reads perfectly well and no real value satisfies.
    if (degreeOf(gap) === 0 && gap[0] === 0) return null;
    return { name, values: polynomialRoots(gap).filter(Number.isFinite) };
  }

  const values = solveNumerically(head, tail, name);
  return values === null ? null : { name, values };
}

// One value shows as itself. Several would crowd the equation out, so they read as a
// count, and the list itself drops down while the pointer is on it.
// Two letters have no one value to give, but they draw a curve between them: the first in
// the alphabet runs along the bottom, and at every step of it the other is solved for.
// Where that answers to two values the curve has two branches, so both are followed.
const GRAPH_SAMPLES = 120;
const GRAPH_SAMPLES_COARSE = 48;

// How far the frame reaches from its middle, which the wheel winds in and out, and where
// that middle is, which dragging carries about.
const GRAPH_RANGE_MIN = 0.5;
const GRAPH_RANGE_MAX = 500;
const GRAPH_RANGE_START = 5;
const GRAPH_ZOOM_STEP = 1.25;
let graphRange = GRAPH_RANGE_START;
let graphCenter = { x: 0, y: 0 };

// Where a point of the graph falls in the frame, which follows both how far the frame
// reaches and where dragging has carried its middle.
function graphToX(x) {
  return ((x - graphCenter.x + graphRange) / (2 * graphRange)) * GRAPH_WIDTH;
}
function graphToY(y) {
  return GRAPH_HEIGHT - ((y - graphCenter.y + graphRange) / (2 * graphRange)) * GRAPH_HEIGHT;
}

// The step between grid lines: whatever keeps about ten squares across the frame, rounded
// to 1, 2 or 5 times a power of ten so the numbers written on them stay round.
function gridStep(range) {
  const rough = (2 * range) / 10;
  const power = 10 ** Math.floor(Math.log10(rough));
  const scaled = rough / power;
  return (scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1) * power;
}

// Candidate values for the second letter spread across the frame, close enough together
// that two crossings nearer than a few pixels are the only ones missed, and no further —
// every one of them costs a reading of both sides, at every step along the curve.
function frameProbes() {
  const probes = [];
  for (let k = 0; k <= 14; k++) probes.push(graphCenter.y - graphRange + (2 * graphRange * k) / 14);
  return probes;
}

function solvePair() {
  const terms = blocks.filter(b => b.hintOf === null);
  const names = [...variableNames(terms)].sort();
  if (names.length !== 2) return null;
  const eqIndex = terms.findIndex(b => b.value === '=');
  if (eqIndex === -1) return null;

  const head = terms.slice(0, eqIndex);
  const tail = terms.slice(eqIndex + 1);
  const [xName, yName] = names;

  const rootsAt = x => {
    const settled = [{ name: xName, value: x }];
    const left = readTerms(head, yName, settled);
    const right = readTerms(tail, yName, settled);
    if (left !== null && right !== null) {
      // A hundredth of a pixel is as close as a drawn curve can tell.
      return polynomialRoots(addTerms(left, right, -1), 1e-4).filter(Number.isFinite);
    }
    // The second letter sits somewhere no polynomial reading reaches — an exponent, as in
    // (5² − C²)ᴸ — so the sides are compared at candidate values for it, the same way a
    // lone letter is. Candidates run across the frame, since a crossing off it cannot be
    // drawn anyway, and are closed in on only as far as the pixel they land in.
    const found = crossingsOf(y => {
      const both = [...settled, { name: yName, value: y }];
      const at = readTerms(head, null, both);
      const to = readTerms(tail, null, both);
      if (at === null || to === null) return null;
      const gap = at[0] - to[0];
      return Number.isFinite(gap) ? gap : null;
    }, frameProbes(), 14);   // a crossing pinned finer than a pixel is pinned enough
    return found === null ? [] : found;
  };

  // Reading the sides at candidate values costs far more than reading them as polynomials,
  // so a curve that needs it is walked in fewer, longer steps.
  const readsAsPolynomial = [-1, 1].every(x => {
    const settled = [{ name: xName, value: x }];
    return readTerms(head, yName, settled) !== null && readTerms(tail, yName, settled) !== null;
  });
  const steps = readsAsPolynomial ? GRAPH_SAMPLES : GRAPH_SAMPLES_COARSE;

  const samples = [];
  for (let i = 0; i <= steps; i++) {
    const x = graphCenter.x - graphRange + (2 * graphRange * i) / steps;
    samples.push({ x, values: rootsAt(x) });
  }

  // A curve that runs out between two steps is followed in to where it really ends — the
  // side of a circle, where its upper and lower halves meet — so it closes there instead
  // of stopping short at whichever step happened to be the last one with an answer.
  const walked = [];
  samples.forEach((sample, i) => {
    const previous = samples[i - 1];
    if (previous && previous.values.length !== sample.values.length) {
      walked.push(edgeBetween(previous, sample, rootsAt));
    }
    walked.push(sample);
  });

  // As many branches as the most answers any one step had, so a curve that doubles back
  // is drawn in full however many times it does.
  const width = Math.max(0, ...walked.map(sample => sample.values.length));
  const branches = Array.from({ length: width }, () => []);
  walked.forEach(sample => {
    branches.forEach((branch, b) => {
      const y = sample.values[b];
      branch.push(y === undefined ? null : { x: sample.x, y });
    });
  });
  // Two letters and an "=" are what there is to draw, so the frame stays whether or not
  // the curve runs through what it is looking at. Dragging past the end of a circle leaves
  // an empty view, not a missing one — and an empty view can be dragged back.
  return { xName, yName, branches };
}

// Closes in on the last of two steps that still has the fuller set of answers, which is
// as near as the curve gets to ending before it does.
function edgeBetween(a, b, rootsAt) {
  const many = a.values.length > b.values.length ? a : b;
  let inside = many.x;
  let outside = (many === a ? b : a).x;
  let values = many.values;
  for (let i = 0; i < 24; i++) {
    const middle = (inside + outside) / 2;
    const at = rootsAt(middle);
    if (at.length === many.values.length) {
      inside = middle;
      values = at;
    } else outside = middle;
  }
  return { x: inside, values };
}

function svgNode(name, attributes) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

// Draws the curve on its grid, or puts the panel away when there is no pair to draw. A
// branch is broken wherever it has no value, and well outside the frame, so a curve
// leaving the top does not come back as a line across it.
// The curve as it was last drawn, which is what the pointer is measured against.
let currentGraph = null;

// The panel is built once and then kept. drawGraph runs on every keypress, every notch of
// the wheel and every mousemove of a drag — building it afresh each time, which is what it
// used to do, would make the gradients and the blur again sixty times a second and restart
// every animation on them along with it. Only the layers whose contents have actually
// changed are written again.
let graphParts = null;

function svgText(attributes, text) {
  const node = svgNode('text', attributes);
  node.textContent = text;
  return node;
}

// A gradient and a blur are dear to make and cost nothing to point at a second time, so
// they are made once, in the defs, and every curve drawn afterwards refers to them.
function graphDefs() {
  const defs = svgNode('defs', {});

  const line = svgNode('linearGradient', { id: 'graph-line', x1: '0%', y1: '0%', x2: '100%', y2: '0%' });
  line.appendChild(svgNode('stop', { offset: '0%', 'stop-color': '#b4ecfd' }));
  line.appendChild(svgNode('stop', { offset: '100%', 'stop-color': '#88f4c5' }));
  defs.appendChild(line);

  const fill = svgNode('linearGradient', { id: 'graph-fill', x1: '0%', y1: '0%', x2: '0%', y2: '100%' });
  fill.appendChild(svgNode('stop', { offset: '0%', 'stop-color': '#88f4c5', 'stop-opacity': '.3' }));
  fill.appendChild(svgNode('stop', { offset: '100%', 'stop-color': '#88f4c5', 'stop-opacity': '0' }));
  defs.appendChild(fill);

  // The curve laid over two blurred copies of itself, which is what reads as light coming
  // off it rather than paint sitting on it.
  const glow = svgNode('filter', { id: 'graph-glow', x: '-30%', y: '-30%', width: '160%', height: '160%' });
  glow.appendChild(svgNode('feGaussianBlur', { stdDeviation: '3', result: 'soft' }));
  const merge = svgNode('feMerge', {});
  merge.appendChild(svgNode('feMergeNode', { in: 'soft' }));
  merge.appendChild(svgNode('feMergeNode', { in: 'soft' }));
  merge.appendChild(svgNode('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(merge);
  defs.appendChild(glow);

  return defs;
}

// A value written at the edge of the frame, on a plate of its own so it stays legible over
// whatever it lands on. SVG will not size a box to its text, so the plate is measured from
// the number's own length, which for digits is close enough to be unnoticeable.
function edgePlate() {
  const group = svgNode('g', { class: 'graph-edge', visibility: 'hidden' });
  const plate = svgNode('rect', { rx: 4, ry: 4, height: 15, x: 0, y: 0, width: 0 });
  const text = svgNode('text', { x: 0, y: 0, 'text-anchor': 'middle' });
  group.append(plate, text);
  return { group, plate, text };
}

function writePlate(label, value, x, y) {
  label.text.textContent = value;
  const width = value.length * 6.2 + 12;
  label.plate.setAttribute('width', width);
  label.plate.setAttribute('x', x - width / 2);
  label.plate.setAttribute('y', y - 11.5);
  label.text.setAttribute('x', x);
  label.text.setAttribute('y', y);
  label.group.setAttribute('visibility', 'visible');
}

function buildGraphPanel(panel) {
  panel.textContent = '';

  const head = document.createElement('div');
  head.className = 'graph-head';
  const names = document.createElement('div');
  names.className = 'graph-names';
  const notes = document.createElement('div');
  notes.className = 'graph-notes';

  /* The wheel winds the frame in and out and a double-click puts it back where it started.
     A finger has neither, and a double-tap belongs to the browser's own zoom, so on a phone
     the same three go on the panel as buttons. Style.css shows them only there. */
  const zoom = document.createElement('div');
  zoom.className = 'graph-zoom';
  [
    ['+', 'ซูมเข้า', () => graphGoTo(Math.max(GRAPH_RANGE_MIN, graphRange / GRAPH_ZOOM_STEP), graphCenter)],
    ['−', 'ซูมออก', () => graphGoTo(Math.min(GRAPH_RANGE_MAX, graphRange * GRAPH_ZOOM_STEP), graphCenter)],
    ['⟲', 'กลับกรอบตั้งต้น', () => graphGoTo(GRAPH_RANGE_START, { x: 0, y: 0 })],
  ].forEach(([face, label, act]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = face;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', act);
    zoom.appendChild(btn);
  });

  head.append(names, notes, zoom);

  // Only this takes the drag. The strips above and below it are for reading, and a press on
  // one of them should no more move the frame than a press on the title of a page moves it.
  const plot = document.createElement('div');
  plot.className = 'graph-plot';

  const svg = svgNode('svg', {
    width: GRAPH_WIDTH,
    height: GRAPH_HEIGHT,
    viewBox: `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`,
  });
  svg.appendChild(graphDefs());

  // Drawn in this order and no other: the grid is behind everything, the shading under the
  // curve, the curve over that, what is marked on it above that, and the pointer's own
  // reading last of all, where nothing can be drawn over it.
  const layers = {};
  ['grid', 'area', 'curve', 'marks', 'cursor'].forEach(name => {
    layers[name] = svgNode('g', { class: 'graph-layer' });
    svg.appendChild(layers[name]);
  });

  const guideX = svgNode('line', { class: 'graph-guide', x1: 0, y1: 0, x2: 0, y2: 0, visibility: 'hidden' });
  const guideY = svgNode('line', { class: 'graph-guide', x1: 0, y1: 0, x2: 0, y2: 0, visibility: 'hidden' });
  const halo = svgNode('circle', { class: 'graph-halo', r: 9, cx: 0, cy: 0, visibility: 'hidden' });
  const dot = svgNode('circle', { class: 'graph-dot', r: 4, cx: 0, cy: 0, visibility: 'hidden' });
  const labelX = edgePlate();
  const labelY = edgePlate();
  layers.cursor.append(guideX, guideY, labelX.group, labelY.group, halo, dot);
  plot.appendChild(svg);

  // The reading lives under the plot rather than floating over a corner of it, so a value
  // never covers the curve it was taken from.
  const foot = document.createElement('div');
  foot.className = 'graph-foot';
  const reading = () => {
    const cell = document.createElement('div');
    cell.className = 'graph-read';
    const key = document.createElement('b');
    const value = document.createElement('span');
    value.textContent = '—';
    cell.append(key, value);
    return { cell, key, value };
  };
  const readX = reading();
  const readY = reading();
  foot.append(readX.cell, readY.cell);

  panel.append(head, plot, foot);
  return {
    panel, svg, plot, names, notes, layers,
    guideX, guideY, halo, dot, labelX, labelY, readX, readY,
    signature: null,
  };
}

// What the curve is a picture of, as the blocks spell it. It changes when the equation
// changes and at no other time — which is exactly when the curve should draw itself again.
// Reading the drawn points instead would fire on every pan and every notch of the wheel,
// since those resample the same curve at new places.
// Joined on a character no block can hold, so no two different equations spell the same
// signature between them — written as an escape rather than typed, or the file itself would
// carry a control byte and stop being read as text by everything that reads text.
function equationSignature() {
  return blocks.filter(b => b.hintOf === null).map(b => b.value).join('\u0000');
}

function drawGraph(graph) {
  const panel = document.getElementById('graph');
  currentGraph = graph;
  panel.hidden = graph === null;
  if (graph === null) return;
  if (graphParts === null) graphParts = buildGraphPanel(panel);

  const parts = graphParts;
  const signature = equationSignature();
  const rewritten = signature !== parts.signature;
  parts.signature = signature;

  drawGraphGrid(parts);
  drawGraphCurve(parts, graph, rewritten && graphMayMove());
  writeGraphHead(parts, graph);
  // A reading taken off the old curve says nothing about the new one.
  if (rewritten) hideGraphPointer();
}

// Numbers ride along their axis, and stay against the edge of the frame once dragging has
// carried that axis out of sight, so a step always has its size written by it. Every fifth
// line is drawn a shade stronger, which is what gives the eye something to count in.
function drawGraphGrid(parts) {
  const layer = parts.layers.grid;
  layer.textContent = '';
  const clamp = (v, low, high) => Math.min(Math.max(v, low), high);
  const numbersY = clamp(graphToY(0) + 14, 13, GRAPH_HEIGHT - 4);
  const numbersX = clamp(graphToX(0) - 6, 24, GRAPH_WIDTH - 4);

  const step = gridStep(graphRange);
  const linesAcross = middle => {
    const out = [];
    for (let k = Math.ceil((middle - graphRange) / step); k * step <= middle + graphRange; k++) {
      out.push({ v: k * step, major: k % 5 === 0 });   // counted in steps, so zero lands exactly
    }
    return out;
  };

  const rule = (v, major) => v === 0 ? 'graph-axis' : major ? 'graph-grid graph-grid-major' : 'graph-grid';

  linesAcross(graphCenter.x).forEach(({ v, major }) => {
    const x = graphToX(v);
    layer.appendChild(svgNode('line', { x1: x, y1: 0, x2: x, y2: GRAPH_HEIGHT, class: rule(v, major) }));
    // A number too near the edge of the frame to fit inside it is left off rather than
    // hung over it.
    if (v !== 0 && x > 16 && x < GRAPH_WIDTH - 16) {
      layer.appendChild(svgText({ x, y: numbersY, class: 'graph-tick', 'text-anchor': 'middle' }, formatNumber(v)));
    }
  });
  linesAcross(graphCenter.y).forEach(({ v, major }) => {
    const y = graphToY(v);
    layer.appendChild(svgNode('line', { x1: 0, y1: y, x2: GRAPH_WIDTH, y2: y, class: rule(v, major) }));
    if (v !== 0 && y > 12 && y < GRAPH_HEIGHT - 5) {
      layer.appendChild(svgText({ x: numbersX, y: y + 4, class: 'graph-tick', 'text-anchor': 'end' }, formatNumber(v)));
    }
  });
  if (Math.abs(graphCenter.x) < graphRange && Math.abs(graphCenter.y) < graphRange) {
    layer.appendChild(svgText({ x: numbersX, y: numbersY, class: 'graph-tick', 'text-anchor': 'end' }, '0'));
  }
}

// A branch broken into the stretches of it that are actually on the frame. The old drawing
// did this inline; it is pulled out because the shading under the curve has to be closed
// off over the same stretches the line is drawn over, or it would fill across a gap.
function graphRuns(branch) {
  const runs = [];
  let run = [];
  branch.forEach(point => {
    if (point === null || Math.abs(point.y - graphCenter.y) > graphRange * 3) {
      if (run.length > 1) runs.push(run);
      run = [];
      return;
    }
    run.push(point);
  });
  if (run.length > 1) runs.push(run);
  return runs;
}

function drawGraphCurve(parts, graph, animate) {
  parts.layers.area.textContent = '';
  parts.layers.curve.textContent = '';
  parts.layers.marks.textContent = '';

  const floor = Math.min(Math.max(graphToY(0), 0), GRAPH_HEIGHT);

  graph.branches.forEach(branch => {
    graphRuns(branch).forEach(run => {
      const xs = run.map(point => graphToX(point.x));
      const ys = run.map(point => graphToY(point.y));
      const points = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

      // The same stretch closed down onto the x axis, which is what gives the curve a side
      // to be read as having rather than a line hanging in the middle of nothing.
      parts.layers.area.appendChild(svgNode('polygon', {
        class: 'graph-area',
        points: `${xs[0].toFixed(1)},${floor.toFixed(1)} ${points} ${xs[xs.length - 1].toFixed(1)},${floor.toFixed(1)}`,
      }));

      const line = svgNode('polyline', { class: 'graph-curve', points });
      parts.layers.curve.appendChild(line);
      if (animate) drawCurveOn(line);
    });
  });

  markCrossings(parts, graph);
}

// The curve drawn as a line being laid down rather than one appearing whole: the whole of
// it is set as a single dash, pushed off its own end, and then let back on.
function drawCurveOn(line) {
  const length = line.getTotalLength();
  if (!Number.isFinite(length) || length === 0) return;
  line.style.transition = 'none';
  line.style.strokeDasharray = `${length}`;
  line.style.strokeDashoffset = `${length}`;
  requestAnimationFrame(() => {
    line.style.transition = `stroke-dashoffset ${GRAPH_DRAW_MS}ms cubic-bezier(.2,.7,.2,1)`;
    line.style.strokeDashoffset = '0';
  });
}

// Where the curve meets an axis, which is the one thing about it worth pointing out without
// being asked. Found between two samples that straddle the axis and read off the line
// between them — as close as the drawn curve itself is, being drawn from the same points.
const GRAPH_MAX_MARKS = 6;

function markCrossings(parts, graph) {
  const found = [];
  graph.branches.forEach(branch => {
    for (let i = 1; i < branch.length && found.length < GRAPH_MAX_MARKS; i++) {
      const from = branch[i - 1];
      const to = branch[i];
      if (from === null || to === null) continue;
      if ((from.y < 0) !== (to.y < 0)) {
        const t = from.y / (from.y - to.y);
        found.push({ x: from.x + t * (to.x - from.x), y: 0 });
      }
      if ((from.x < 0) !== (to.x < 0)) {
        const t = from.x / (from.x - to.x);
        found.push({ x: 0, y: from.y + t * (to.y - from.y) });
      }
    }
  });

  found.forEach(mark => {
    const x = graphToX(mark.x);
    const y = graphToY(mark.y);
    if (x < 6 || x > GRAPH_WIDTH - 6 || y < 6 || y > GRAPH_HEIGHT - 6) return;
    parts.layers.marks.appendChild(svgNode('circle', { class: 'graph-cross', r: 3.5, cx: x, cy: y }));
  });
}

function writeGraphHead(parts, graph) {
  parts.names.textContent = '';
  [graph.xName, graph.yName].forEach((name, i) => {
    const chip = document.createElement('span');
    chip.className = 'graph-chip';
    chip.dataset.axis = i === 0 ? 'x' : 'y';
    chip.textContent = name;
    parts.names.appendChild(chip);
  });

  parts.notes.textContent = '';
  const note = text => {
    const tag = document.createElement('span');
    tag.className = 'graph-note';
    tag.textContent = text;
    parts.notes.appendChild(tag);
  };
  // A curve that doubles back is drawn as more than one branch, and how many there are is
  // worth saying — it is the difference between a line and a closed shape.
  if (graph.branches.length > 1) note(`${graph.branches.length} กิ่ง`);
  note(`▫ ${formatNumber(gridStep(graphRange))}`);

  parts.readX.key.textContent = graph.xName;
  parts.readY.key.textContent = graph.yName;
}

function hintText(solution) {
  const values = solution.values;
  if (values.length === 0) return '(ไม่มีคำตอบ)';
  return values.length === 1 ? `(${formatNumber(values[0])})` : `(${values.length} คำตอบ)`;
}

// The values a count stands for, written under it one to a line. It hangs out of the flow
// and only shows on hover, so the equation neither moves nor gets read over.
function writeAnswerList(el, name, values) {
  const list = document.createElement('div');
  list.className = 'answers';
  values.forEach(value => {
    const line = document.createElement('div');
    line.textContent = `${name} = ${formatNumber(value)}`;
    list.appendChild(line);
  });
  el.appendChild(list);
}

// A value on show keeps up with the equation it was read from, and slides back out once
// the display stops being an equation that block still answers for.
function syncVariableHints(solution) {
  const stale = new Set();
  blocks.forEach(hint => {
    if (hint.hintOf === null) return;
    const owner = blocks.find(b => b.id === hint.hintOf);
    if (!owner || solution === null || !holdsVariable(owner, solution.name)) {
      stale.add(hint.id);
      return;
    }
    hint.value = hintText(solution);
  });
  if (stale.size === 0) return;
  exitingIds = new Set([...exitingIds, ...[...stale].map(String)]);
  blocks = blocks.filter(b => !stale.has(b.id));
}

// Pressing a lit-up variable block slides its value in beside it, in parentheses so it
// reads as an answer rather than another term. Pressing it again pulls the value out.
function handleVariableClick(id) {
  const idx = blocks.findIndex(b => b.id === id);
  if (idx === -1) return;

  const shown = blocks.find(b => b.hintOf === id);
  if (shown) {
    exitingIds = new Set([String(shown.id)]);
    blocks = blocks.filter(b => b.id !== shown.id);
  } else {
    const solution = solveVariable();
    if (solution === null) return;
    const hint = { id: idCounter++, value: hintText(solution), active: false, dupIds: null, hintOf: id };
    enteringIds = new Set([String(hint.id)]);
    blocks.splice(idx + 1, 0, hint);
  }
  render();
}

// An "=" keeps whatever it put down in step with the blocks it was computed from —
// recomputed against the right side minus its own contribution, so a balancing term
// closes the new gap instead of chasing itself. A "=" holding plain copies produces no
// values to match and is left alone.
function refreshAnswers() {
  blocks.forEach((b, idx) => {
    if (b.value !== '=' || !b.dupIds) return;
    const own = new Set(b.dupIds);
    const tail = blocks.slice(idx + 1).filter(x => !own.has(x.id) && x.hintOf === null);
    const values = balancingValues(blocks.slice(0, idx).filter(x => x.hintOf === null), tail);
    if (values === null || values.length !== b.dupIds.length) return;
    b.dupIds.forEach((id, i) => {
      const target = blocks.find(x => x.id === id);
      if (!target) return;
      // A block that already comes to the right number is left as it is written, so an
      // answer written out as a fraction is not put straight back into decimals.
      const written = evaluateBlocks([target]);
      if (written !== null && formatNumber(written) === values[i]) return;
      target.value = values[i];
    });
  });
}

// Stages the upward roll for one glyph swap: the old glyph rises out of the way while
// the new one rides up into its place. Call it while the block still shows the old
// value, then run the returned step once render() has written the new one.
function rollGlyph(el, oldValue) {
  const box = el.getBoundingClientRect();
  const host = display.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.className = 'block-ghost';
  writeValue(ghost, oldValue);
  ghost.style.left = `${box.left - host.left}px`;
  ghost.style.top = `${box.top - host.top}px`;
  display.appendChild(ghost);

  return () => {
    void ghost.offsetWidth;                   // the ghost is brand new — flush it into
    ghost.style.transition = `transform ${ROLL_MS}ms ease, opacity ${ROLL_MS}ms ease`;
    ghost.style.transform = `translateY(-${ROLL_RISE})`;  // layout before it can animate
    ghost.style.opacity = '0';
    setTimeout(() => ghost.remove(), ROLL_MS);

    el.style.transition = 'none';
    el.style.transform = `translateY(${ROLL_RISE})`;
    el.style.opacity = '0';
    requestAnimationFrame(() => {
      el.style.transition = `transform ${ROLL_MS}ms ease, opacity ${ROLL_MS}ms ease`;
      el.style.transform = '';
      el.style.opacity = '';
    });
  };
}

// Rewrites block values, then rolls whatever reads differently now — the block that
// changed, and any answer that followed it. Ctrl-clicking an answer is undone by the
// recompute, so it lands back on its old value and is skipped here instead of flickering.
function applyValueChange(change) {
  const before = new Map(blocks.map(b => [b.id, b.value]));
  change();
  refreshAnswers();

  const rolls = blocks
    .filter(b => before.get(b.id) !== b.value)
    .map(b => {
      const target = display.querySelector(`.block[data-id="${b.id}"]`);
      return target && rollGlyph(target, before.get(b.id));
    })
    .filter(Boolean);
  if (rolls.length === 0) return;

  render();
  rolls.forEach(startRoll => startRoll());
}

// Only something standing for a value can be raised or rooted — an operator, an "=", a
// lone "." or a value on show for a letter can't.
function holdsValue(block) {
  if (!block || block.hintOf !== null) return false;
  // A fraction is a value like any other to write on — it is bracketed first, so what goes
  // on next takes all of it. So is a hundredth, which a bar, a square or a root reads
  // through to what it stands for.
  if (splitFraction(block.value).under !== null) return true;
  const written = coreOf(block);
  const core = written.endsWith(PERCENT) ? written.slice(0, -1) : written;
  // A closing bracket stands for everything back to the one that opened it, which is a
  // value like any other: (1 + 2)² is 9. A group already gathered into one block stands for
  // the same thing, whatever has since been written on it — ²√(9×9) is nine, and nine can be
  // divided, squared, rooted and taken hundredths of like any other nine.
  return VARIABLE.test(core) || core === ')' || strippedGroup(core) !== null
    || (numericText(core) !== null && /[0-9]/.test(core));
}

// The block the keypad is writing on: whatever ctrl-click pointed it at, or the last one.
function writingOn() {
  return typingTarget() || blocks[blocks.length - 1];
}

// The x² key writes onto that block instead of landing as one of its own, so pressing 4
// then x² leaves a single "4²". Pressing it again squares that again.
function squareLast() {
  // With the keypad in a fraction, the square goes on what is written there rather than on
  // the block holding it: 8 ÷ 9 then x² is eight over nine squared. It lands on the end of
  // that half, so it takes the last thing written — a bracket included, which is how a
  // whole numerator gets squared.
  const aimed = typingTarget();
  if (aimed !== null && (typingInto.kind === 'numerator' || typingInto.kind === 'denominator')) {
    const aim = typingInto;
    const text = slotText(aimed, aim);
    if (text === '') return;
    aim.fresh = false;
    applyValueChange(() => { aimed.value = rewriteSlot(aimed, aim, text + LEVEL + '2'); });
    return;
  }
  const last = writingOn();
  if (!holdsValue(last)) return;
  applyValueChange(() => { last.value = wholeValue(last.value) + LEVEL + '2'; });
}

// Whether a block carries on spelling out the number the one before it started. Digits
// run together until something closes them: a root written in front of one, an exponent
// written above the one before, or anything that is not a digit at all.
function continuesNumber(block, previous) {
  const here = splitFraction(block.value);
  const there = splitFraction(previous.value);
  if (here.under !== null || there.under !== null) return false;   // a bar closes it too
  const [base] = splitLevels(here.main);
  if (splitRoots(base).indexes.length > 0 || numericText(base) === null) return false;
  const [previousBase, ...previousExponents] = splitLevels(there.main);
  return previousExponents.length === 0 && numericText(splitRoots(previousBase).core) !== null;
}

// The ÷ key stacks that block over what is typed next, the way a fraction is written by
// hand rather than strung out in a line, and points the keypad under the bar so the next
// key lands there.
// Whether a run can be gathered into one block, which means writing every value in it out
// as text: a fraction or a root inside cannot be, since a bar and a radical are not
// characters anything reads back.
function gatherable(run) {
  return run.every(b => b.hintOf === null
    && splitFraction(b.value).under === null
    && splitRoots(splitLevels(b.value)[0]).indexes.length === 0);
}

// How far back a key written onto a block reaches. A number is written over all of its
// digits, and a bracket over all of the group it closes — 1, 6, ÷ is 16 over what follows,
// and ( 4 + 5 ) ÷ is the whole bracket over it, not just the bracket that closed it.
function reachOf(index) {
  if (coreOf(blocks[index]) === ')') {
    const open = matchingOpen(blocks, index);
    return open !== -1 && gatherable(blocks.slice(open, index + 1)) ? open : index;
  }
  let start = index;
  while (start > 0 && continuesNumber(blocks[start], blocks[start - 1])) start--;
  return start;
}

// Gathers everything from `start` up into the block at `index`, so what is written on that
// block covers all of it — a numerator or a radicand is written as one thing.
function gatherInto(start, index) {
  const taken = blocks.slice(start, index);
  const text = taken.map(b => b.value).join('') + blocks[index].value;
  taken.forEach(b => exitingIds.add(String(b.id)));
  blocks = blocks.filter(b => !taken.includes(b));
  return text;
}

function divideLast() {
  // Pressing ÷ twice reads left to right, as it does on any calculator: 8 ÷ 9 ÷ 2 is eight
  // ninths over two, not eight over four and a half. So the new bar takes the whole block —
  // unless a bracket is open in the slot being written, where the bar belongs inside it.
  const aimed = typingTarget();
  if (aimed !== null && (typingInto.kind === 'numerator' || typingInto.kind === 'denominator')) {
    const aim = typingInto;
    const text = slotText(aimed, aim);
    if (openDepth(text) > 0) {
      aim.fresh = false;
      applyValueChange(() => { aimed.value = rewriteSlot(aimed, aim, text + FRACTION); });
      return;
    }
  }
  const index = blocks.indexOf(writingOn());
  if (index === -1 || !holdsValue(blocks[index])) return;
  const target = blocks[index];
  const numerator = wholeValue(gatherInto(reachOf(index), index));
  // `auto` marks the keypad as having landed here by itself, which is what lets an
  // operator take it back out to carry the display on past the fraction.
  typingInto = { id: target.id, kind: 'denominator', path: ['denominator'], fresh: true, auto: true };
  applyValueChange(() => { target.value = numerator + FRACTION; });
}

const MINUS = '−';

// A value with the sign of the term starting at `at` turned over: the minus in front of it
// taken away, or one put there. Only a minus that is a sign counts — one with a value
// before it is a subtraction, and belongs to the two either side of it, not to one.
function negated(text, at) {
  if (at === 0 && text.startsWith(MINUS)) return text.slice(1);
  const signed = at > 0 && text[at - 1] === MINUS && (at === 1 || /[+−×÷(]/.test(text[at - 2]));
  if (signed) return text.slice(0, at - 1) + text.slice(at);
  return text.slice(0, at) + MINUS + text.slice(at);
}

// The +/- key turns the sign of what it is written on: 1 becomes −1, and −1 becomes 1
// again. In a fraction it turns what is written in that half; on the display it turns the
// whole number, or the whole bracket, the way the other keys written onto a block reach.
function negateLast() {
  const aimed = typingTarget();
  if (aimed !== null && (typingInto.kind === 'numerator' || typingInto.kind === 'denominator')) {
    const aim = typingInto;
    const text = slotText(aimed, aim);
    const at = lastTermStart(text);
    if (at === null) return;
    aim.fresh = false;
    applyValueChange(() => { aimed.value = rewriteSlot(aimed, aim, negated(text, at)); });
    return;
  }
  const index = blocks.indexOf(writingOn());
  if (index === -1 || !holdsValue(blocks[index])) return;
  const target = blocks[index];
  const value = gatherInto(reachOf(index), index);
  applyValueChange(() => { target.value = negated(value, 0); });
}

// The % key writes onto that block too, so pressing 5, 0, % leaves a single "50%" — half
// of one, not fifty. It reaches back over the whole number, or the whole bracket, the way
// the other keys written onto a block do.
function percentLast() {
  const index = blocks.indexOf(writingOn());
  if (index === -1 || !holdsValue(blocks[index])) return;
  if (coreOf(blocks[index]).endsWith(PERCENT)) return;   // a hundredth of a hundredth is not written
  const target = blocks[index];
  const value = wholeValue(gatherInto(reachOf(index), index));
  applyValueChange(() => { target.value = value + PERCENT; });
}

// The ²√x key writes in front of that block the same way, so pressing 9 then ²√x leaves a
// single "√9", and pressing it again roots that again. It goes in front of the whole
// number, not just its last digit, so 1, 6, ²√x is √16 — the same reach x² has.
// Where the last thing written in a slot begins, which is what a root written there takes:
// the digits that spell out a number, the letter standing on its own, or the whole bracket
// when one closes it. An operator has nothing to take, so it comes back null.
function lastTermStart(text) {
  const end = text.length - 1;
  if (end < 0) return null;
  if (text[end] === ')') {
    let depth = 0;
    for (let i = end; i >= 0; i--) {
      if (text[i] === ')') depth++;
      else if (text[i] === '(' && --depth === 0) return i;
    }
    return null;
  }
  if (!/[0-9.A-Z]/.test(text[end])) return null;
  if (!/[0-9.]/.test(text[end])) return end;
  let start = end;
  while (start > 0 && /[0-9.]/.test(text[start - 1])) start--;
  return start;
}

function rootLast() {
  // With the keypad in a fraction, the root goes over what is written there rather than
  // over the block holding it, and reaches back over the last thing written the same way
  // it reaches back over a whole number on the display.
  const aimed = typingTarget();
  if (aimed !== null && (typingInto.kind === 'numerator' || typingInto.kind === 'denominator')) {
    const aim = typingInto;
    const text = slotText(aimed, aim);
    const at = lastTermStart(text);
    if (at === null) return;
    aim.fresh = false;
    const rooted = text.slice(0, at) + ROOT + '2' + ROOT_END + text.slice(at);
    applyValueChange(() => { aimed.value = rewriteSlot(aimed, aim, rooted); });
    return;
  }
  const index = blocks.indexOf(writingOn());
  if (index === -1 || !holdsValue(blocks[index])) return;
  const start = reachOf(index);
  // A group that cannot be gathered still gets its root, written in front of the bracket
  // that opens it, which is where it reads from even when it is not drawn across the whole.
  if (start === index && coreOf(blocks[index]) === ')') {
    const open = matchingOpen(blocks, index);
    if (open === -1) return;
    const opener = blocks[open];
    applyValueChange(() => { opener.value = ROOT + '2' + ROOT_END + opener.value; });
    return;
  }
  const target = blocks[index];
  const radicand = wholeValue(gatherInto(start, index));
  applyValueChange(() => { target.value = ROOT + '2' + ROOT_END + radicand; });
}

// While ctrl (or cmd) is down, whichever block the cursor is over lights up if a
// ctrl-click would point the keypad at it, so where typing is about to land is clear
// before the click.
// Reading the flag off the event covers the key going down and coming back up, mousemove
// covers coming back to the window holding it, and blur covers letting go outside.
// Shift reads the display in terms rather than in blocks, and lights what it reads in
// green. Ctrl wins while both are down, since that is the one that writes.
const trackPicking = e => {
  const ctrl = ctrlOn(e);
  display.classList.toggle('picking', ctrl);
  display.classList.toggle('choosing', shiftOn(e) && !ctrl);
  markCarry();
};
window.addEventListener('keydown', trackPicking);
window.addEventListener('keyup', trackPicking);
display.addEventListener('mousemove', e => {
  hovered = e.target.closest('.block');
  hoveredHalf = hovered === null ? null : e.target.closest('.denominator');
  trackPicking(e);
});
display.addEventListener('mouseleave', () => {
  hovered = null;
  hoveredHalf = null;
  markCarry();
});
window.addEventListener('blur', () => {
  // A mode set on the bar is a switch the reader threw, not a key they are holding, so it
  // survives the window losing focus the way a held key cannot.
  display.classList.toggle('picking', touchMods.ctrl);
  display.classList.toggle('choosing', touchMods.shift && !touchMods.ctrl);
  markCarry();
});

// Clicking the display itself rather than a block puts the keypad back on the end, so
// there is a way out of typing into a slot that does not mean typing something first.
display.addEventListener('click', e => {
  if (e.target !== display || typingInto === null) return;
  leaveSlot();
  render();
});

const graphPanel = document.getElementById('graph');

// The frame eased towards where it has been asked to go, rather than cut to it. Winding the
// wheel then reads as the same frame being wound, which is what the numbers sliding along
// the axes are saying too; a jump reads as a different frame being put in its place.
// IM.damp comes off the same curve whatever the refresh rate, and IM.ticker is the one loop
// the whole page already shares, so this adds no second one.
let graphAim = null;

function stopGraphEase() {
  if (graphAim === null) return;
  graphAim = null;
  if (window.IM && IM.ticker) IM.ticker.remove(easeGraphFrame);
}

function easeGraphFrame(dt) {
  if (graphAim === null) return;
  graphRange = IM.damp(graphRange, graphAim.range, 13, dt);
  graphCenter = {
    x: IM.damp(graphCenter.x, graphAim.x, 13, dt),
    y: IM.damp(graphCenter.y, graphAim.y, 13, dt),
  };
  // Near enough that another frame of it would move nothing a pixel could show.
  const settled = Math.abs(graphRange - graphAim.range) < graphAim.range * 5e-4
    && Math.abs(graphCenter.x - graphAim.x) < graphAim.range * 5e-4
    && Math.abs(graphCenter.y - graphAim.y) < graphAim.range * 5e-4;
  if (settled) {
    graphRange = graphAim.range;
    graphCenter = { x: graphAim.x, y: graphAim.y };
    stopGraphEase();
  }
  drawGraph(solvePair());
}

function graphGoTo(range, center) {
  const aim = {
    range: Math.min(GRAPH_RANGE_MAX, Math.max(GRAPH_RANGE_MIN, range)),
    x: center === undefined ? graphCenter.x : center.x,
    y: center === undefined ? graphCenter.y : center.y,
  };
  // With motion turned down, or with core.js missing, it simply arrives.
  if (!graphMayMove() || !window.IM || !IM.ticker) {
    stopGraphEase();
    graphRange = aim.range;
    graphCenter = { x: aim.x, y: aim.y };
    drawGraph(solvePair());
    return;
  }
  const running = graphAim !== null;
  graphAim = aim;
  if (!running) IM.ticker.add(easeGraphFrame);
}

// The wheel winds the graph's frame in and out. It only ever reaches the graph itself, so
// the page behind it stays where it is. Each notch compounds on where the frame is already
// headed, not on where it has got to, so spinning it winds smoothly rather than fighting
// the ease already under way.
graphPanel.addEventListener('wheel', e => {
  e.preventDefault();
  const zoom = e.deltaY < 0 ? 1 / GRAPH_ZOOM_STEP : GRAPH_ZOOM_STEP;
  const from = graphAim === null ? graphRange : graphAim.range;
  graphGoTo(from * zoom);
}, { passive: false });

function hideGraphPointer() {
  if (graphParts === null) return;
  const parts = graphParts;
  [parts.guideX, parts.guideY, parts.halo, parts.dot, parts.labelX.group, parts.labelY.group]
    .forEach(node => node.setAttribute('visibility', 'hidden'));
  parts.readX.value.textContent = '—';
  parts.readY.value.textContent = '—';
}

// The point of the curve nearest the pointer, or null when the pointer is not on it.
// Distance is measured to the line between two steps rather than to the steps themselves,
// so a curve climbing steeply — where its steps stand far apart — is no harder to point
// at than a flat one.
const GRAPH_REACH = 10;

function nearestOnCurve(px, py) {
  if (currentGraph === null) return null;
  const toX = graphToX;
  const toY = graphToY;
  let best = null;

  currentGraph.branches.forEach(branch => branch.forEach((point, i) => {
    const next = branch[i + 1];
    if (point === null || !next) return;
    const ax = toX(point.x);
    const ay = toY(point.y);
    const dx = toX(next.x) - ax;
    const dy = toY(next.y) - ay;
    const span = dx * dx + dy * dy;
    const along = span === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
    const distance = Math.hypot(px - (ax + along * dx), py - (ay + along * dy));
    if (best === null || distance < best.distance) {
      best = {
        distance,
        px: ax + along * dx,
        py: ay + along * dy,
        x: point.x + along * (next.x - point.x),
        y: point.y + along * (next.y - point.y),
      };
    }
  }));
  return best !== null && best.distance <= GRAPH_REACH ? best : null;
}

// Pointing at the curve reads off the point pointed at, and nothing shows while the
// pointer is off it. The reading is rounded to a tenth of a grid square — fine enough to
// be worth having, coarse enough that it does not flicker through a new digit every pixel
// — so it follows the zoom, a square being worth less the further in the frame is wound.
// Dragging carries the frame under the pointer, so what has been left off the edge can be
// brought back into view. The pointer is followed in graph units, so what was taken hold
// of stays under it however far the frame is wound in.
let graphDrag = null;

graphPanel.addEventListener('pointerdown', e => {
  // Only the plot itself is dragged. The strips above and below carry the reading, and a
  // press on one of them should no more move the frame than a press on a caption would.
  if (graphParts === null || e.target.closest('.graph-plot') === null) return;
  e.preventDefault();                         // no text selection dragged along with it
  stopGraphEase();                            // a hand on it overrides where it was headed
  graphDrag = {
    x: e.clientX,
    y: e.clientY,
    // Where it started, kept so that letting go without having moved can be told from a drag
    // — that is a tap, and a tap reads the curve rather than carrying the frame nowhere.
    fromX: e.clientX,
    fromY: e.clientY,
    perPixel: (2 * graphRange) / graphParts.svg.getBoundingClientRect().width,
  };
  graphPanel.classList.add('dragging');
  hideGraphPointer();
});

window.addEventListener('pointermove', e => {
  if (graphDrag === null) return;
  graphCenter = {
    x: graphCenter.x - (e.clientX - graphDrag.x) * graphDrag.perPixel,
    y: graphCenter.y + (e.clientY - graphDrag.y) * graphDrag.perPixel,
  };
  graphDrag.x = e.clientX;
  graphDrag.y = e.clientY;
  drawGraph(solvePair());
});

// Let go anywhere, even off the panel, and the drag is over.
window.addEventListener('pointerup', () => {
  if (graphDrag === null) return;
  graphDrag = null;
  graphPanel.classList.remove('dragging');
});
window.addEventListener('pointercancel', () => {
  if (graphDrag === null) return;
  graphDrag = null;
  graphPanel.classList.remove('dragging');
});

// A double-click puts the frame back where it started, which is the way back from having
// dragged or wound the curve out of sight. Both the reach and the middle are eased back at
// once, so it reads as the frame being carried home rather than replaced.
graphPanel.addEventListener('dblclick', () => {
  graphGoTo(GRAPH_RANGE_START, { x: 0, y: 0 });
});

// Pointing at the curve reads the point pointed at, and says it three times over: a dot on
// the spot, a dashed line dropped to each axis with the value written where it lands, and
// the pair of them spelled out in the strip below. Nothing shows while the pointer is off
// the curve. The reading is rounded to a tenth of a grid square — fine enough to be worth
// having, coarse enough not to flicker through a new digit every pixel — so it follows the
// zoom, a square being worth less the further in the frame is wound.
function readCurveAt(x, y) {
  if (graphParts === null || currentGraph === null) return;
  const parts = graphParts;

  const box = parts.svg.getBoundingClientRect();
  const on = nearestOnCurve(
    (x - box.left) * (GRAPH_WIDTH / box.width),
    (y - box.top) * (GRAPH_HEIGHT / box.height),
  );
  if (on === null) return hideGraphPointer();

  const grain = gridStep(graphRange) / 10;
  const round = v => Math.round(v / grain) * grain;
  const clamp = (v, low, high) => Math.min(Math.max(v, low), high);
  // Where the guides run to: the axes themselves, or the edge of the frame once dragging
  // has carried an axis out of sight — either way, the side the value belongs to.
  const axisY = clamp(graphToY(0), 0, GRAPH_HEIGHT);
  const axisX = clamp(graphToX(0), 0, GRAPH_WIDTH);

  parts.guideX.setAttribute('x1', on.px);
  parts.guideX.setAttribute('y1', on.py);
  parts.guideX.setAttribute('x2', on.px);
  parts.guideX.setAttribute('y2', axisY);
  parts.guideY.setAttribute('x1', on.px);
  parts.guideY.setAttribute('y1', on.py);
  parts.guideY.setAttribute('x2', axisX);
  parts.guideY.setAttribute('y2', on.py);
  parts.guideX.setAttribute('visibility', 'visible');
  parts.guideY.setAttribute('visibility', 'visible');

  parts.halo.setAttribute('cx', on.px);
  parts.halo.setAttribute('cy', on.py);
  parts.dot.setAttribute('cx', on.px);
  parts.dot.setAttribute('cy', on.py);
  parts.halo.setAttribute('visibility', 'visible');
  parts.dot.setAttribute('visibility', 'visible');

  const readX = formatNumber(round(on.x));
  const readY = formatNumber(round(on.y));
  // Kept inside the frame, so a value at the very edge is still read rather than clipped.
  writePlate(parts.labelX, readX, clamp(on.px, 22, GRAPH_WIDTH - 22), clamp(axisY + 16, 14, GRAPH_HEIGHT - 3));
  writePlate(parts.labelY, readY, clamp(axisX - 24, 24, GRAPH_WIDTH - 24), clamp(on.py, 12, GRAPH_HEIGHT - 5));

  parts.readX.value.textContent = readX;
  parts.readY.value.textContent = readY;
}

graphPanel.addEventListener('pointermove', e => {
  if (graphDrag !== null) return;             // a drag is moving the frame, not reading it
  readCurveAt(e.clientX, e.clientY);
});
graphPanel.addEventListener('pointerleave', hideGraphPointer);

/* A finger laid on the plot is a drag, so the reading above never happens on a phone: the
   frame moves under it and the readout is skipped for exactly that reason. A press that goes
   nowhere is not a drag though, and that is a tap — so a tap reads the curve where it landed,
   which is the only way the coordinates are reachable without a hovering cursor. */
graphPanel.addEventListener('pointerup', e => {
  if (graphDrag === null || !onPhone) return;
  if (Math.hypot(e.clientX - graphDrag.fromX, e.clientY - graphDrag.fromY) > CARRY_SLOP) return;
  readCurveAt(e.clientX, e.clientY);
});

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const lettersDiv = document.getElementById('letters');
alphabet.split('').forEach(letter => {
  const btn = document.createElement('button');
  btn.textContent = letter;
  btn.onclick = () => action(letter);
  lettersDiv.appendChild(btn);
});

render();

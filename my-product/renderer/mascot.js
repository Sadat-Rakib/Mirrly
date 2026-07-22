// Mirrly mascots — hand-drawn SVGs, animated with shared CSS classes on #mascot:
// .walk (legs + bob), .flip (face left), .busy (thought bubble). Blink, breathe,
// and tail sway run on their own. No external assets.
(function () {
  const NS = 'http://www.w3.org/2000/svg';

  function bubble() {
    return (
      '<g class="m-bubble">' +
      '<circle cx="86" cy="52" r="2.2" fill="rgba(255,255,255,0.92)"/>' +
      '<circle cx="92" cy="44" r="3.4" fill="rgba(255,255,255,0.92)"/>' +
      '<ellipse cx="101" cy="30" rx="16" ry="11" fill="rgba(255,255,255,0.92)"/>' +
      '<circle class="bd bd1" cx="94" cy="30" r="2.3" fill="#5B6270"/>' +
      '<circle class="bd bd2" cx="101" cy="30" r="2.3" fill="#5B6270"/>' +
      '<circle class="bd bd3" cx="108" cy="30" r="2.3" fill="#5B6270"/>' +
      '</g>'
    );
  }

  function wrap(body) {
    return (
      '<svg viewBox="0 0 120 112" width="100%" height="100%" xmlns="' + NS + '" aria-hidden="true">' +
      body +
      bubble() +
      '</svg>'
    );
  }

  const cat = wrap(
    '<ellipse class="m-shadow" cx="58" cy="105" rx="32" ry="5" fill="rgba(0,0,0,0.28)"/>' +
    '<g class="m-root">' +
    '<path class="m-tail" d="M80 84 C100 82 106 64 96 52" stroke="#E8944A" stroke-width="8" fill="none" stroke-linecap="round"/>' +
    '<g class="leg leg-b1"><rect x="36" y="88" width="10" height="17" rx="5" fill="#E8944A"/></g>' +
    '<g class="leg leg-b2"><rect x="70" y="88" width="10" height="17" rx="5" fill="#E8944A"/></g>' +
    '<ellipse cx="58" cy="79" rx="25" ry="19" fill="#F5A45C"/>' +
    '<ellipse cx="58" cy="84" rx="15" ry="11" fill="#FFE3C2"/>' +
    '<g class="leg leg-f1"><rect x="46" y="90" width="10" height="16" rx="5" fill="#F5A45C"/></g>' +
    '<g class="leg leg-f2"><rect x="60" y="90" width="10" height="16" rx="5" fill="#F5A45C"/></g>' +
    '<g class="m-head">' +
    '<path d="M36 20 L42 2 L55 12 Z" fill="#F5A45C"/>' +
    '<path d="M40 16.5 L43.8 6.5 L50.5 12 Z" fill="#F78FB3"/>' +
    '<path d="M80 20 L74 2 L61 12 Z" fill="#F5A45C"/>' +
    '<path d="M76 16.5 L72.2 6.5 L65.5 12 Z" fill="#F78FB3"/>' +
    '<circle cx="58" cy="34" r="26" fill="#F5A45C"/>' +
    '<path d="M50 10 q4 -2.5 8 0" stroke="#E8944A" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
    '<path d="M46 15 q3.5 -2.2 7 0" stroke="#E8944A" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<g class="m-eye"><circle cx="47" cy="34" r="4.6" fill="#2B2B33"/><circle cx="48.6" cy="32.4" r="1.5" fill="#fff"/></g>' +
    '<g class="m-eye"><circle cx="69" cy="34" r="4.6" fill="#2B2B33"/><circle cx="70.6" cy="32.4" r="1.5" fill="#fff"/></g>' +
    '<rect class="m-eyelid" x="41" y="27" width="13" height="14" rx="5" fill="#F5A45C"/>' +
    '<rect class="m-eyelid" x="63" y="27" width="13" height="14" rx="5" fill="#F5A45C"/>' +
    '<ellipse cx="58" cy="45" rx="10" ry="7" fill="#FFE3C2"/>' +
    '<path d="M55.4 41.5 h5.2 l-2.6 3.2 Z" fill="#F78FB3"/>' +
    '<path d="M58 44.7 q-2.8 4 -6 1.4 M58 44.7 q2.8 4 6 1.4" stroke="#B96A2E" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<circle cx="36" cy="42" r="3.4" fill="rgba(247,143,179,0.5)"/>' +
    '<circle cx="80" cy="42" r="3.4" fill="rgba(247,143,179,0.5)"/>' +
    '<path d="M30 38 l-12 -2 M31 43 l-12 2 M85 38 l12 -2 M84 43 l12 2" stroke="#C97F3F" stroke-width="1.3" stroke-linecap="round"/>' +
    '</g></g>'
  );

  // Golden retriever vibe — floppy ears, friendly snout, shorter waggy tail.
  const dog = wrap(
    '<ellipse class="m-shadow" cx="58" cy="105" rx="34" ry="5" fill="rgba(0,0,0,0.28)"/>' +
    '<g class="m-root">' +
    '<path class="m-tail" d="M82 78 C104 70 108 88 94 92" stroke="#C8883A" stroke-width="9" fill="none" stroke-linecap="round"/>' +
    '<g class="leg leg-b1"><rect x="34" y="88" width="11" height="17" rx="5" fill="#C8883A"/></g>' +
    '<g class="leg leg-b2"><rect x="70" y="88" width="11" height="17" rx="5" fill="#C8883A"/></g>' +
    '<ellipse cx="58" cy="78" rx="27" ry="20" fill="#E0A04E"/>' +
    '<ellipse cx="58" cy="84" rx="16" ry="11" fill="#FFE8C8"/>' +
    '<g class="leg leg-f1"><rect x="44" y="90" width="11" height="16" rx="5" fill="#E0A04E"/></g>' +
    '<g class="leg leg-f2"><rect x="60" y="90" width="11" height="16" rx="5" fill="#E0A04E"/></g>' +
    '<g class="m-head">' +
    '<ellipse cx="34" cy="42" rx="9" ry="16" fill="#C8883A" transform="rotate(-18 34 42)"/>' +
    '<ellipse cx="82" cy="42" rx="9" ry="16" fill="#C8883A" transform="rotate(18 82 42)"/>' +
    '<circle cx="58" cy="34" r="26" fill="#E0A04E"/>' +
    '<ellipse cx="58" cy="48" rx="14" ry="10" fill="#FFE8C8"/>' +
    '<g class="m-eye"><circle cx="47" cy="32" r="4.4" fill="#2B2B33"/><circle cx="48.5" cy="30.5" r="1.4" fill="#fff"/></g>' +
    '<g class="m-eye"><circle cx="69" cy="32" r="4.4" fill="#2B2B33"/><circle cx="70.5" cy="30.5" r="1.4" fill="#fff"/></g>' +
    '<rect class="m-eyelid" x="41" y="25" width="13" height="14" rx="5" fill="#E0A04E"/>' +
    '<rect class="m-eyelid" x="63" y="25" width="13" height="14" rx="5" fill="#E0A04E"/>' +
    '<ellipse cx="58" cy="46" rx="6" ry="4.5" fill="#2B2B33"/>' +
    '<path d="M58 50 q-4 5 -8 2 M58 50 q4 5 8 2" stroke="#8B5A2B" stroke-width="1.7" fill="none" stroke-linecap="round"/>' +
    '<circle cx="38" cy="44" r="3.2" fill="rgba(232,140,120,0.45)"/>' +
    '<circle cx="78" cy="44" r="3.2" fill="rgba(232,140,120,0.45)"/>' +
    '</g></g>'
  );

  // Fox — rust coat, white chest, pointed ears, bushy tail tip.
  const fox = wrap(
    '<ellipse class="m-shadow" cx="58" cy="105" rx="32" ry="5" fill="rgba(0,0,0,0.28)"/>' +
    '<g class="m-root">' +
    '<path class="m-tail" d="M78 82 C102 78 110 58 98 48" stroke="#E07030" stroke-width="10" fill="none" stroke-linecap="round"/>' +
    '<circle cx="98" cy="48" r="5" fill="#F5F0E8"/>' +
    '<g class="leg leg-b1"><rect x="36" y="88" width="10" height="17" rx="5" fill="#C45A20"/></g>' +
    '<g class="leg leg-b2"><rect x="70" y="88" width="10" height="17" rx="5" fill="#C45A20"/></g>' +
    '<ellipse cx="58" cy="79" rx="24" ry="18" fill="#E87830"/>' +
    '<ellipse cx="58" cy="84" rx="13" ry="10" fill="#F5F0E8"/>' +
    '<g class="leg leg-f1"><rect x="46" y="90" width="10" height="16" rx="5" fill="#E87830"/></g>' +
    '<g class="leg leg-f2"><rect x="60" y="90" width="10" height="16" rx="5" fill="#E87830"/></g>' +
    '<g class="m-head">' +
    '<path d="M38 22 L44 0 L56 14 Z" fill="#E87830"/>' +
    '<path d="M42 18 L46 6 L52 14 Z" fill="#F5F0E8"/>' +
    '<path d="M78 22 L72 0 L60 14 Z" fill="#E87830"/>' +
    '<path d="M74 18 L70 6 L64 14 Z" fill="#F5F0E8"/>' +
    '<circle cx="58" cy="34" r="25" fill="#E87830"/>' +
    '<path d="M38 40 Q58 58 78 40 Q58 48 38 40 Z" fill="#F5F0E8"/>' +
    '<g class="m-eye"><circle cx="47" cy="32" r="4.2" fill="#2B2B33"/><circle cx="48.4" cy="30.6" r="1.3" fill="#fff"/></g>' +
    '<g class="m-eye"><circle cx="69" cy="32" r="4.2" fill="#2B2B33"/><circle cx="70.4" cy="30.6" r="1.3" fill="#fff"/></g>' +
    '<rect class="m-eyelid" x="41" y="25" width="12" height="13" rx="5" fill="#E87830"/>' +
    '<rect class="m-eyelid" x="63" y="25" width="12" height="13" rx="5" fill="#E87830"/>' +
    '<path d="M55.5 40 h5 l-2.5 3.2 Z" fill="#2B2B33"/>' +
    '<path d="M58 43 q-2.5 3.5 -5.5 1.2 M58 43 q2.5 3.5 5.5 1.2" stroke="#8B3A18" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '</g></g>'
  );

  // Bunny — soft gray, long ears, cotton-puff tail.
  const bunny = wrap(
    '<ellipse class="m-shadow" cx="58" cy="105" rx="30" ry="5" fill="rgba(0,0,0,0.28)"/>' +
    '<g class="m-root">' +
    '<circle class="m-tail" cx="86" cy="78" r="9" fill="#F4F1EC"/>' +
    '<g class="leg leg-b1"><rect x="36" y="90" width="10" height="15" rx="5" fill="#9AA3B2"/></g>' +
    '<g class="leg leg-b2"><rect x="70" y="90" width="10" height="15" rx="5" fill="#9AA3B2"/></g>' +
    '<ellipse cx="58" cy="80" rx="24" ry="18" fill="#C5CDD8"/>' +
    '<ellipse cx="58" cy="85" rx="14" ry="10" fill="#F4F1EC"/>' +
    '<g class="leg leg-f1"><rect x="46" y="92" width="10" height="14" rx="5" fill="#C5CDD8"/></g>' +
    '<g class="leg leg-f2"><rect x="60" y="92" width="10" height="14" rx="5" fill="#C5CDD8"/></g>' +
    '<g class="m-head">' +
    '<ellipse cx="42" cy="8" rx="8" ry="22" fill="#C5CDD8" transform="rotate(-12 42 8)"/>' +
    '<ellipse cx="42" cy="10" rx="4" ry="14" fill="#F3C4D4" transform="rotate(-12 42 10)"/>' +
    '<ellipse cx="74" cy="8" rx="8" ry="22" fill="#C5CDD8" transform="rotate(12 74 8)"/>' +
    '<ellipse cx="74" cy="10" rx="4" ry="14" fill="#F3C4D4" transform="rotate(12 74 10)"/>' +
    '<circle cx="58" cy="36" r="24" fill="#C5CDD8"/>' +
    '<g class="m-eye"><circle cx="48" cy="36" r="4.3" fill="#2B2B33"/><circle cx="49.4" cy="34.6" r="1.3" fill="#fff"/></g>' +
    '<g class="m-eye"><circle cx="68" cy="36" r="4.3" fill="#2B2B33"/><circle cx="69.4" cy="34.6" r="1.3" fill="#fff"/></g>' +
    '<rect class="m-eyelid" x="42" y="29" width="12" height="13" rx="5" fill="#C5CDD8"/>' +
    '<rect class="m-eyelid" x="62" y="29" width="12" height="13" rx="5" fill="#C5CDD8"/>' +
    '<ellipse cx="58" cy="46" rx="9" ry="6" fill="#F4F1EC"/>' +
    '<ellipse cx="58" cy="44" rx="4" ry="3" fill="#F78FB3"/>' +
    '<path d="M58 47 q-2.8 3.5 -6 1 M58 47 q2.8 3.5 6 1" stroke="#8A6A7A" stroke-width="1.5" fill="none" stroke-linecap="round"/>' +
    '<circle cx="40" cy="44" r="3" fill="rgba(243,196,212,0.55)"/>' +
    '<circle cx="76" cy="44" r="3" fill="rgba(243,196,212,0.55)"/>' +
    '</g></g>'
  );

  const characters = {
    cat: { id: 'cat', name: 'Cat', svg: cat },
    dog: { id: 'dog', name: 'Dog', svg: dog },
    fox: { id: 'fox', name: 'Fox', svg: fox },
    bunny: { id: 'bunny', name: 'Bunny', svg: bunny }
  };

  window.MASCOT = {
    defaultId: 'cat',
    ids: Object.keys(characters),
    characters,
    get(id) {
      return characters[id] || characters.cat;
    }
  };
})();

/* focus-areas.js
 * Single source of truth for sport focus areas, shared across:
 *   coach-profile-setup.html, coach-dashboard.html (coach picks),
 *   athlete-signup.html (athlete improvement focus),
 *   select-coach.html, for-athletes.html (display + matching).
 *
 * Edit the lists here — they're placeholders/sensible defaults to ship,
 * refine per sport later. Loaded as a plain <script src="focus-areas.js">;
 * everything is exposed on window.
 *
 * Caps (enforced at the app layer, not the DB):
 *   coach   — up to 3 curated  + up to 2 custom  (max 5 total)
 *   athlete — 1 to 3 improvement focuses (required, at least 1)
 */
(function (global) {
  "use strict";

  var FOCUS_AREAS = {
    basketball: ['Shooting', 'Ball handling', 'Defence', 'Finishing at the rim', 'Court vision/IQ', 'Conditioning', 'U14 development', 'U16 development', 'U18 development'],
    afl:        ['Kicking technique', 'Marking', 'Tackling', 'Game IQ', 'Set shot', 'Junior development', 'Senior development'],
    soccer:     ['First touch', 'Finishing', 'Passing range', 'Defence positioning', 'Goalkeeping', 'U12 development', 'U16 development'],
    tennis:     ['Serve technique', 'Baseline rallying', 'Net play', 'Mental game', 'Doubles strategy', 'Junior development'],
    cricket:    ['Batting technique', 'Bowling action', 'Fielding', 'Wicketkeeping', 'Game strategy', 'Junior development'],
    netball:    ['Shooting accuracy', 'Footwork', 'Defence', 'Passing & vision', 'Positioning', 'Junior development'],
    rugby:      ['Tackling technique', 'Passing', 'Kicking', 'Rucking & breakdown', 'Game IQ', 'Junior development'],
    swimming:   ['Stroke technique', 'Starts & turns', 'Breathing & rhythm', 'Race strategy', 'Conditioning', 'Junior development'],
    athletics:  ['Sprint mechanics', 'Endurance & pacing', 'Jumps technique', 'Throws technique', 'Race strategy', 'Junior development'],
    hockey:     ['Stick skills', 'Drag-flick', 'Penalty corners', 'Passing & vision', 'Defence positioning', 'Junior development']
  };

  // App-layer caps.
  var FOCUS_LIMITS = { coachCurated: 3, coachCustom: 2, athleteFocus: 3 };

  // Map the stored sport label (e.g. "AFL", "Rugby / League", "Strength &
  // Conditioning") onto a FOCUS_AREAS key. Returns "" when there's no match.
  var SPORT_ALIASES = {
    basketball: 'basketball',
    afl: 'afl', aussierules: 'afl', australianrules: 'afl',
    soccer: 'soccer', football: 'soccer',
    tennis: 'tennis',
    cricket: 'cricket',
    netball: 'netball',
    rugby: 'rugby', rugbyleague: 'rugby', rugbyunion: 'rugby', league: 'rugby',
    swimming: 'swimming',
    athletics: 'athletics', trackandfield: 'athletics',
    hockey: 'hockey', fieldhockey: 'hockey'
  };

  function sportKey(sport) {
    if (!sport) return '';
    var norm = String(sport).toLowerCase().replace(/[^a-z]/g, ''); // strip spaces/slashes/&
    if (FOCUS_AREAS[norm]) return norm;
    return SPORT_ALIASES[norm] || '';
  }

  // The curated focus-area list for a given sport ("" if the sport isn't covered).
  function focusAreasForSport(sport) {
    var key = sportKey(sport);
    return key ? FOCUS_AREAS[key].slice() : [];
  }

  global.FOCUS_AREAS = FOCUS_AREAS;
  global.FOCUS_LIMITS = FOCUS_LIMITS;
  global.focusAreasForSport = focusAreasForSport;
  global.focusSportKey = sportKey;
})(window);
